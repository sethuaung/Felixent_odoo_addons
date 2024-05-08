# -*- coding: utf-8 -*-
# Part of Odoo. See COPYRIGHT & LICENSE files for full copyright and licensing details.
{
    'name': 'Attachment Preview PDF',
    'version': '15.0.0.1',
    'category': 'Services/Tools',
    'summary': 'Preview attached PDF file without downloading it.',
    'description': '''
        Preview attached PDF file without downloading it.
    ''',
    'author': 'Warlock Technologies Pvt Ltd.',
    'website': 'http://warlocktechnologies.com',
    'support': 'support@warlocktechnologies.com',
    'depends': ['im_livechat', 'mail'],
    'data': [],
    'assets': {
        'web.assets_backend': [
            '/wt_attachment_preview_pdf/static/js/attachment_view.js',
            '/wt_attachment_preview_pdf/static/scss/custome.scss',
        ],
        'web.assets_qweb': [
            '/wt_attachment_preview_pdf/static/xml/attachment_view.xml',
        ],
    },
    
    'images': [],
    'application': True,
    'installable': True,
    'auto_install': False,
    'license': 'OPL-1',
    'images': ['image/screen_image.png'],
    'external_dependencies': {
    },
}
