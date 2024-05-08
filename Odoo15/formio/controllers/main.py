# Copyright Nova Code (http://www.novacode.nl)
# See LICENSE file for full licensing details.

import json
import logging

from collections import deque
from os.path import dirname

from odoo import http, fields, tools
from odoo.http import request

from ..models.formio_builder import \
    STATE_CURRENT as BUILDER_STATE_CURRENT, STATE_OBSOLETE as BUILDER_STATE_OBSOLETE

from ..models.formio_form import \
    STATE_PENDING as FORM_STATE_PENDING, STATE_DRAFT as FORM_STATE_DRAFT, \
    STATE_COMPLETE as FORM_STATE_COMPLETE, STATE_CANCEL as FORM_STATE_CANCEL

from .utils import generate_uuid4

_logger = logging.getLogger(__name__)


class FormioController(http.Controller):

    ##############
    # Form Builder
    ##############

    @http.route('/formio/builder/<int:builder_id>', type='http', auth='user', website=True)
    def builder_root(self, builder_id, **kwargs):
        if not request.env.user.has_group('formio.group_formio_admin'):
            # TODO Render template with message?
            return request.redirect("/")

        # TODO REMOVE (still needed or obsolete legacy?)
        # Needed to update language
        context = request.env.context.copy()
        context.update({'lang': request.env.user.lang})
        request.env.context = context

        builder = request.env['formio.builder'].browse(builder_id)
        languages = builder.languages
        lang_en = request.env.ref('base.lang_en')

        if lang_en.active and builder.language_en_enable and 'en_US' not in languages.mapped('code'):
            languages |= request.env.ref('base.lang_en')

        values = {
            'languages': languages,
            'builder': builder,
            'formio_css_assets': builder.formio_css_assets,
            'formio_js_assets': builder.formio_js_assets,
            'extra_assets': builder.extra_asset_ids,
            # uuid is used to disable assets (js, css) caching by hrefs
            'uuid': generate_uuid4()
        }
        return request.render('formio.formio_builder_embed', values)

    @http.route('/formio/builder/<int:builder_id>/config', type='json', auth='user', website=True)
    def builder_config(self, builder_id, **kwargs):
        if not request.env.user.has_group('formio.group_formio_admin'):
            return
        builder = request.env['formio.builder'].browse(builder_id)
        res = {'schema': {}, 'options': {}}

        if builder:
            if builder.schema:
                res['schema'] = json.loads(builder.schema)
            res['options'] = builder._get_js_options()
            res['params'] = builder._get_js_params()
            res['locales'] = builder._get_form_js_locales()

        return res

    @http.route('/formio/builder/<model("formio.builder"):builder>/save', type='json', auth="user", methods=['POST'], website=True)
    def builder_save(self, builder, **post):
        if not request.env.user.has_group('formio.group_formio_admin'):
            return

        if 'builder_id' not in post or int(post['builder_id']) != builder.id:
            return

        schema = json.dumps(post['schema'])
        builder.write({'schema': schema})

    #######################
    # Form - backend - uuid
    #######################

    @http.route(
        '/formio/form/<string:uuid>',
        type='http', auth='user', website=True)
    def form_root(self, uuid, **kwargs):
        form = self._get_form(uuid, 'read')
        if not form:
            msg = 'Form UUID %s' % uuid
            return request.not_found(msg)

        args = request.httprequest.args
        if args.get('api') == 'getData':
            return self._api_get_data(uuid)
        else:
            # TODO REMOVE (still needed or obsolete legacy?)
            # Needed to update language
            context = request.env.context.copy()
            context.update({'lang': request.env.user.lang})
            request.env.context = context

            languages = form.builder_id.languages
            lang_en = request.env.ref('base.lang_en')

            if lang_en.active and form.builder_id.language_en_enable and 'en_US' not in languages.mapped('code'):
                languages |= request.env.ref('base.lang_en')

            values = {
                'languages': languages.sorted('name'),
                'form': form,
                'formio_css_assets': form.builder_id.formio_css_assets,
                'formio_js_assets': form.builder_id.formio_js_assets,
                'extra_assets': form.builder_id.extra_asset_ids,
                # uuid is used to disable assets (js, css) caching by hrefs
                'uuid': generate_uuid4()
            }
            return request.render('formio.formio_form_embed', values)
        
    @http.route('/formio/form/<string:form_uuid>/config', type='json', auth='user', website=True)
    def form_config(self, form_uuid, **kwargs):
        form = self._get_form(form_uuid, 'read')
        # TODO remove config (key)
        res = {'schema': {}, 'options': {}, 'config': {}, 'params': {}}

        if form and form.builder_id.schema:
            res['schema'] = json.loads(form.builder_id.schema)
            res['options'] = self._get_form_js_options(form)
            res['params'] = self._get_form_js_params(form)
            res['locales'] = self._get_form_js_locales(form)

        return res

    # TODO Remove this endpoint (not used?)
    @http.route('/formio/form/create/<string:builder_uuid>', type='json', auth='user', website=True)
    def form_config_builder(self, builder_uuid, **kwargs):
        domain = [('uuid', '=', builder_uuid)]
        formio_builder = request.env['formio.builder'].sudo().search(domain, limit=1)
        if not formio_builder or formio_builder.state != BUILDER_STATE_CURRENT:
            return {}

        if formio_builder.schema:
            return json.loads(formio_builder.schema)
        else:
            return {}

    @http.route('/formio/form/<string:uuid>/submission', type='json', auth='user', website=True)
    def form_submission(self, uuid, **kwargs):
        form = self._get_form(uuid, 'read')

        # Submission data
        if form and form.submission_data:
            submission_data = json.loads(form.submission_data)
        else:
            submission_data = {}

        # ETL Odoo data
        if form:
            etl_odoo_data = form.sudo()._etl_odoo_data()
            submission_data.update(etl_odoo_data)

        return json.dumps(submission_data)

    @http.route('/formio/form/<string:uuid>/submit', type='json', auth="user", methods=['POST'], website=True)
    def form_submit(self, uuid, **post):
        """ POST with ID instead of uuid, to get the model object right away """

        form = self._get_form(uuid, 'write')
        if not form or form.state == FORM_STATE_COMPLETE:
            # TODO raise or set exception (in JSON resonse) ?
            return

        vals = {
            'submission_data': json.dumps(post['data']),
            'submission_user_id': request.env.user.id,
            'submission_date': fields.Datetime.now(),
        }

        if post.get('saveDraft') or (post['data'].get('saveDraft') and not post['data'].get('submit')):
            vals['state'] = FORM_STATE_DRAFT
        else:
            vals['state'] = FORM_STATE_COMPLETE

        form.write(vals)

        if vals.get('state') == FORM_STATE_COMPLETE:
            form.after_submit()
        elif vals.get('state') == FORM_STATE_DRAFT:
            form.after_save_draft()

    ########################
    # Form - fetch Odoo data
    ########################

    @http.route(
        ['/formio/form/<string:uuid>/data',
         '/formio/portal/form/<string:uuid>/data'],
        type='http', auth='user', website=True)
    def form_data(self, uuid, **kwargs):
        """ Get data from a resource-object.

        DEPRECATED / CHANGE
        ===================
        Use the query string "?api=getData" in URLs:
        - /formio/form/<string:uuid>?api=getData
        - /formio/portal/form/<string:uuid>?api=getData

        EXAMPLE
        =======
        This example loads data into Select Component, whereby choices
        are the Partner/Contact names with city "Sittard".

        formio configuration (in "Data" tab)
        -------------------------------------
        - Data Source URL: /data
        - Filter Query: model=res.partner&label=name&domain_fields=city&city=Sittard
        """
        msg = "The /data fetching URLs %s will be deprecated and work with a minor change in Odoo version 16.0\nMore info on Wiki: %s" % (
            "/formio/form/<string:uuid>/data, /formio/portal/form/<string:uuid>/data",
            "https://github.com/novacode-nl/odoo-formio/wiki/Populate-a-Select-Component-data-(options)-with-data-from-Odoo-model.field",
        )
        _logger.warning(msg)
        return self._api_get_data(uuid)

    @http.route('/formio/form/<string:uuid>/res_data', type='http', auth='user', website=True)
    def form_res_data(self, uuid, **kwargs):
        """ Get data from a linked resource-object (by: res_model_id, res_id),

        This also traverses relations.

        EXAMPLE
        =======
        This example loads data into Select Component whereby choices
        are the product-names from a Sale Order.
        The Form(Builder) has the "Resource Model" set to "Quotation" (i.e. sale.order).

        formio configuration (in "Data" tab)
        -------------------------------------
        - Data Source URL: /res_data
        - Filter Query: field=order_line.product_id&label=name
        """

        form = self._get_form(uuid, 'read')
        if not form:
            return

        args = request.httprequest.args

        field = args.get('field')
        # TODO: formio error?
        if field is None:
            _logger('field is missing in "Data Filter Query"')

        label = args.get('label')
        # TODO: formio error?
        if label is None:
            _logger.error('label is missing in "Data Filter Query"')

        try:
            record = request.env[form.res_model_id.model].browse(form.res_id)

            fields = deque(args.get('field').split('.'))
            res_data = []
            while fields:
                _field = fields.popleft()

                if not res_data or not isinstance(res_data.ids, list):
                    res_data = getattr(record, _field)
                elif isinstance(res_data, list):
                    res_data = [getattr(r, _field) for r in res_data]

            data = json.dumps([{'id': r['id'], 'label': r[label]} for r in res_data])
            return data
        except Exception as e:
            _logger.error("Exception: %s" % e)

    #######
    # Fonts
    #######

    @http.route(['/web/content/<int:id>/fonts/<string:name>'], type='http', auth="public")
    def send_fonts_file(self, id, name):
        """
        WARNING
        -------
        This route (/fonts/) is a rather iffy assumption which could
        cause troubles.  Of course this could be requested by other
        parts, but not yet in standard Odoo routes.

        :param int id: The ID of the file (attachment) which requests the fonts file.
            File(s) requesting this font file, are CSS files (formio.js library).
        :param str name: The name of the fontfile in request.
        """

        ir_attach = request.env['ir.attachment'].sudo()
        attach = ir_attach.browse(id)
        if not attach.formio_asset_formio_version_id:
            msg = 'Request expects a Forms (formio.js) fonts file (id: %s, name: %s' % (id, name)
            _logger.warning(msg)
            return request.not_found(msg)

        attach_dir = dirname(attach.store_fname)
        fonts_dir = '{attach_dir}/fonts/'.format(attach_dir=attach_dir)
        fontfile_path = request.env['ir.attachment']._full_path(fonts_dir)
        fontfile_path += '/%s' % name

        return http.send_file(fontfile_path)

    #########
    # Helpers
    #########

    def _api_get_data(self, form_uuid):
        form = self._get_form(form_uuid, 'read')
        if not form:
            _logger.info('api=getData: Form (uuid) %s is not found or allowed' % form_uuid)
            return []

        args = request.httprequest.args
        model = args.get('model')
        # TODO: formio error?
        if model is None:
            _logger('model is missing in "Data Filter Query"')

        label = args.get('label')
        # TODO: formio error?
        if label is None:
            _logger.error('label is missing in "Data Filter Query"')

        domain = []
        domain_fields = args.getlist('domain_fields')
        # domain_fields_op = args.getlist('domain_fields_operators')

        for domain_field in domain_fields:
            value = args.get(domain_field)

            if value is not None:
                filter = (domain_field, '=', value)
                domain.append(filter)

        if not domain:
            domain = form._generate_odoo_domain(domain, params=args.to_dict())

        try:
            language = args.get('language')
            if language:
                lang = request.env['res.lang']._from_formio_ietf_code(language)
                model_obj = request.env[model].with_context(lang=lang)
            else:
                model_obj = request.env[model]
            # Bypass access rights restrictions - by configuration !
            # Ensure the model_obj search_read can query by direct ir.rule domain.
            # This also sets sudo() on the model_obj, if the ir.rule is present.
            model_rule_id = args.get('model_rule_id')
            model_rule_xmlid = args.get('model_rule_xmlid')
            if model_rule_id and int(model_rule_id):
                rule = request.env['ir.rule'].sudo().browse(int(model_rule_id))
            elif model_rule_xmlid:
                rule = request.env.ref(model_rule_xmlid).sudo()
            else:
                rule = False
            if rule and rule.active and rule.model_id.model == model:
                add_domain = rule._formio_compute_direct_domain(model, 'read')
                if add_domain:
                    domain += add_domain
                    model_obj = model_obj.sudo()
            # limit, order and query
            limit = (args.get('limit') and int(args.get('limit'))) or None
            order = args.get('sort') or model_obj._order + ', id'
            records = model_obj.search_read(
                domain=domain, fields=[label], limit=limit, order=order
            )
            data = json.dumps([{'id': r['id'], 'label': r[label]} for r in records])
            return data
        except Exception as e:
            _logger.error("Exception: %s" % e)

    def _get_form_js_options(self, form):
        options = form._get_js_options()

        # language
        Lang = request.env['res.lang']
        if request.env.user.lang in form.languages.mapped('code'):
            language = Lang._formio_ietf_code(request.env.user.lang)
        else:
            language = Lang._formio_ietf_code(request._context['lang'])
        options['language'] = language
        return options

    def _get_form_js_locales(self, form):
        return form.builder_id._get_form_js_locales()

    def _get_form_js_params(self, form):
        return form._get_js_params()

    def _get_form(self, uuid, mode):
        return request.env['formio.form'].get_form(uuid, mode)
