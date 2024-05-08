odoo.define('wt_attachment_preview_pdf.DocumentViewer', function (require) {
"use strict";

var core = require('web.core');
var Widget = require('web.Widget');
var { hidePDFJSButtons } = require('@web/legacy/js/libs/pdfjs');

var QWeb = core.qweb;

var SCROLL_ZOOM_STEP = 0.1;
var ZOOM_STEP = 0.5;

var DocumentViewer = Widget.extend({
    template: "wt_attachment_preview_pdf.DocumentViewer",
    events: {
        'click .o_download_btn': '_onDownload',
        'click .o_viewer_img': '_onImageClicked',
        'click .o_viewer_video': '_onVideoClicked',
        'click .move_next': '_onNext',
        'click .move_previous': '_onPrevious',
        'click .o_rotate': '_onRotate',
        'click .o_zoom_in': '_onZoomIn',
        'click .o_zoom_out': '_onZoomOut',
        'click .o_zoom_reset': '_onZoomReset',
        'click .o_close_btn, .o_viewer_img_wrapper': '_onClose',
        'click .o_print_btn': '_onPrint',
        'DOMMouseScroll .o_viewer_content': '_onScroll', // Firefox
        'mousewheel .o_viewer_content': '_onScroll', // Chrome, Safari, IE
        'keydown': '_onKeydown',
        'keyup': '_onKeyUp',
        'mousedown .o_viewer_img': '_onStartDrag',
        'mousemove .o_viewer_content': '_onDrag',
        'mouseup .o_viewer_content': '_onEndDrag'
    },
    /**
     * The documentViewer takes an array of objects describing attachments in
     * argument, and the ID of an active attachment (the one to display first).
     * Documents that are not of type image or video are filtered out.
     *
     * @override
     * @param {Array<Object>} attachments list of attachments
     * @param {integer} activeAttachmentID
     */
    init: function (parent, attachments, activeAttachmentID) {
        this._super.apply(this, arguments);
        this.attachment = _.filter(attachments, function (attachment) {
            var match = attachment.type === 'url' ? attachment.url.match("(youtu|.png|.jpg|.gif)") : attachment.mimetype.match("(image|video|application/pdf|text)");
            if (match) {
                attachment.fileType = match[1];
                if (match[1].match("(.png|.jpg|.gif)")) {
                    attachment.fileType = 'image';
                }
                if (match[1] === 'youtu') {
                    var youtube_array = attachment.url.split('/');
                    var youtube_token = youtube_array[youtube_array.length - 1];
                    if (youtube_token.indexOf('watch') !== -1) {
                        youtube_token = youtube_token.split('v=')[1];
                        var amp = youtube_token.indexOf('&');
                        if (amp !== -1) {
                            youtube_token = youtube_token.substring(0, amp);
                        }
                    }
                    attachment.youtube = youtube_token;
                }
                return true;
            }
        });
        this.activeAttachment = _.findWhere(attachments, { id: activeAttachmentID });
        this.modelName = 'ir.attachment';
        this._reset();
    },
    /**
     * Open a modal displaying the active attachment
     * @override
     */
    start: function () {
        this.$el.modal('show');
        this.$el.on('hidden.bs.modal', _.bind(this._onDestroy, this));
        this.$('.o_viewer_img').on("load", _.bind(this._onImageLoaded, this));
        this.$('[data-toggle="tooltip"]').tooltip({ delay: 0 });
        return this._super.apply(this, arguments);
    },
    /**
     * @override
     */
    destroy: function () {
        if (this.isDestroyed()) {
            return;
        }
        this.trigger_up('document_viewer_closed');
        this.$el.modal('hide');
        this.$el.remove();
        this._super.apply(this, arguments);
    },

    //--------------------------------------------------------------------------
    // Private
    //---------------------------------------------------------------------------

    /**
     * @private
     */
    _next: function () {
        var index = _.findIndex(this.attachment, this.activeAttachment);
        index = (index + 1) % this.attachment.length;
        this.activeAttachment = this.attachment[index];
        this._updateContent();
    },
    /**
     * @private
     */
    _previous: function () {
        var index = _.findIndex(this.attachment, this.activeAttachment);
        index = index === 0 ? this.attachment.length - 1 : index - 1;
        this.activeAttachment = this.attachment[index];
        this._updateContent();
    },
    /**
     * @private
     */
    _reset: function () {
        this.scale = 1;
        this.dragStartX = this.dragstopX = 0;
        this.dragStartY = this.dragstopY = 0;
    },
    /**
     * Render the active attachment
     *
     * @private
     */
    _updateContent: function () {
        this.$('.o_viewer_content').html(QWeb.render('wt_attachment_preview_pdf.DocumentViewer.Content', {
            widget: this
        }));
        if (this.activeAttachment.fileType === 'application/pdf') {
            hidePDFJSButtons(this.$('.o_viewer_content')[0]);
        }
        this.$('.o_viewer_img').on("load", _.bind(this._onImageLoaded, this));
        this.$('[data-toggle="tooltip"]').tooltip({ delay: 0 });
        this._reset();
    },
    /**
     * Get CSS transform property based on scale and angle
     *
     * @private
     * @param {float} scale
     * @param {float} angle
     */
    _getTransform: function (scale, angle) {
        return 'scale3d(' + scale + ', ' + scale + ', 1) rotate(' + angle + 'deg)';
    },
    /**
     * Rotate image clockwise by provided angle
     *
     * @private
     * @param {float} angle
     */
    _rotate: function (angle) {
        this._reset();
        var new_angle = (this.angle || 0) + angle;
        this.$('.o_viewer_img').css('transform', this._getTransform(this.scale, new_angle));
        // this.$('.o_viewer_img').css('max-width', new_angle % 180 !== 0 ? $(document).height() : '100%');
        this.$('.o_viewer_img').css('max-height', new_angle % 180 !== 0 ? $(document).width() : '100%');
        this.angle = new_angle;
    },
    /**
     * Zoom in/out image by provided scale
     *
     * @private
     * @param {integer} scale
     */
    _zoom: function (scale) {
        if (scale > 0.5) {
            this.$('.o_viewer_img').css('transform', this._getTransform(scale, this.angle || 0));
            this.scale = scale;
        }
        this.$('.o_zoom_reset').add('.o_zoom_out').toggleClass('disabled', scale === 1);
    },

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * @private
     * @param {MouseEvent} e
     */
    _onClose: function (e) {
        e.preventDefault();
        this.destroy();
    },
    /**
     * When popup close complete destroyed modal even DOM footprint too
     *
     * @private
     */
    _onDestroy: function () {
        this.destroy();
    },
    /**
     * @private
     * @param {MouseEvent} e
     */
    _onDownload: function (e) {
        e.preventDefault();
        window.location = '/web/content/' + this.modelName + '/' + this.activeAttachment.id + '/' + 'datas' + '?download=true';
    },
    /**
     * @private
     * @param {MouseEvent} e
     */
    _onDrag: function (e) {
        e.preventDefault();
        if (this.enableDrag) {
            var $image = this.$('.o_viewer_img');
            var $zoomer = this.$('.o_viewer_zoomer');
            var top = $image.prop('offsetHeight') * this.scale > $zoomer.height() ? e.clientY - this.dragStartY : 0;
            var left = $image.prop('offsetWidth') * this.scale > $zoomer.width() ? e.clientX - this.dragStartX : 0;
            $zoomer.css("transform", "translate3d(" + left + "px, " + top + "px, 0)");
            $image.css('cursor', 'move');
        }
    },
    /**
     * @private
     * @param {MouseEvent} e
     */
    _onEndDrag: function (e) {
        e.preventDefault();
        if (this.enableDrag) {
            this.enableDrag = false;
            this.dragstopX = e.clientX - this.dragStartX;
            this.dragstopY = e.clientY - this.dragStartY;
            this.$('.o_viewer_img').css('cursor', '');
        }
    },
    /**
     * On click of image do not close modal so stop event propagation
     *
     * @private
     * @param {MouseEvent} e
     */
    _onImageClicked: function (e) {
        e.stopPropagation();
    },
    /**
     * Remove loading indicator when image loaded
     * @private
     */
    _onImageLoaded: function () {
        this.$('.o_loading_img').hide();
    },
    /**
     * Move next previous attachment on keyboard right left key
     *
     * @private
     * @param {KeyEvent} e
     */
    _onKeydown: function (e) {
        switch (e.which) {
            case $.ui.keyCode.RIGHT:
                e.preventDefault();
                this._next();
                break;
            case $.ui.keyCode.LEFT:
                e.preventDefault();
                this._previous();
                break;
        }
    },
    /**
     * Close popup on ESCAPE keyup
     *
     * @private
     * @param {KeyEvent} e
     */
    _onKeyUp: function (e) {
        switch (e.which) {
            case $.ui.keyCode.ESCAPE:
                e.preventDefault();
                this._onClose(e);
                break;
        }
    },
    /**
     * @private
     * @param {MouseEvent} e
     */
    _onNext: function (e) {
        e.preventDefault();
        this._next();
    },
    /**
     * @private
     * @param {MouseEvent} e
     */
    _onPrevious: function (e) {
        e.preventDefault();
        this._previous();
    },
    /**
     * @private
     * @param {MouseEvent} e
     */
    _onPrint: function (e) {
        e.preventDefault();
        var src = this.$('.o_viewer_img').prop('src');
        var script = QWeb.render('wt_attachment_preview_pdf.PrintImage', {
            src: src
        });
        var printWindow = window.open('about:blank', "_new");
        printWindow.document.open();
        printWindow.document.write(script);
        printWindow.document.close();
    },
    /**
     * Zoom image on scroll
     *
     * @private
     * @param {MouseEvent} e
     */
    _onScroll: function (e) {
        var scale;
        if (e.originalEvent.wheelDelta > 0 || e.originalEvent.detail < 0) {
            scale = this.scale + SCROLL_ZOOM_STEP;
            this._zoom(scale);
        } else {
            scale = this.scale - SCROLL_ZOOM_STEP;
            this._zoom(scale);
        }
    },
    /**
     * @private
     * @param {MouseEvent} e
     */
    _onStartDrag: function (e) {
        e.preventDefault();
        this.enableDrag = true;
        this.dragStartX = e.clientX - (this.dragstopX || 0);
        this.dragStartY = e.clientY - (this.dragstopY || 0);
    },
    /**
     * On click of video do not close modal so stop event propagation
     * and provide play/pause the video instead of quitting it
     *
     * @private
     * @param {MouseEvent} e
     */
    _onVideoClicked: function (e) {
        e.stopPropagation();
        var videoElement = e.target;
        if (videoElement.paused) {
            videoElement.play();
        } else {
            videoElement.pause();
        }
    },
    /**
     * @private
     * @param {MouseEvent} e
     */
    _onRotate: function (e) {
        e.preventDefault();
        this._rotate(90);
    },
    /**
     * @private
     * @param {MouseEvent} e
     */
    _onZoomIn: function (e) {
        e.preventDefault();
        var scale = this.scale + ZOOM_STEP;
        this._zoom(scale);
    },
    /**
     * @private
     * @param {MouseEvent} e
     */
    _onZoomOut: function (e) {
        e.preventDefault();
        var scale = this.scale - ZOOM_STEP;
        this._zoom(scale);
    },
    /**
     * @private
     * @param {MouseEvent} e
     */
    _onZoomReset: function (e) {
        e.preventDefault();
        this.$('.o_viewer_zoomer').css("transform", "");
        this._zoom(1);
    },
});
return DocumentViewer;
});


odoo.define('wt_attachment_preview_pdf.many2many_attachment_preview_widget', function (require) {
    "use strict";

var AbstractField = require('web.AbstractField');
var core = require('web.core');
var registry = require('web.field_registry');
var DocumentViewer = require('wt_attachment_preview_pdf.DocumentViewer');

var _t = core._t;
var _lt = core._lt;
var qweb = core.qweb;

/**
 * Widget to upload or delete one or more files at the same time.
 */
var FieldMany2ManyAttachmentPreview = AbstractField.extend({
    template: "FieldBinaryFileUploader",
    template_files: "FieldAttachmentFileUploader.files",
    supportedFieldTypes: ['many2many'],
    fieldsToFetch: {
        name: {type: 'char'},
        mimetype: {type: 'char'},
    },
    events: {
        'click .o_attach': '_onAttach',
        'click .o_attachment_delete': '_onDelete',
        'change .o_input_file': '_onFileChanged',
        'click .o_attachment_wrap': '_previewAttachment',
    },
    /**
     * @constructor
     */
    init: function () {
        this._super.apply(this, arguments);

        if (this.field.type !== 'many2many' || this.field.relation !== 'ir.attachment') {
            var msg = _t("The type of the field '%s' must be a many2many field with a relation to 'ir.attachment' model.");
            throw _.str.sprintf(msg, this.field.string);
        }

        this.uploadedFiles = {};
        this.uploadingFiles = [];
        this.fileupload_id = _.uniqueId('oe_fileupload_temp');
        this.accepted_file_extensions = (this.nodeOptions && this.nodeOptions.accepted_file_extensions) || this.accepted_file_extensions || '*';
        $(window).on(this.fileupload_id, this._onFileLoaded.bind(this));

        this.metadata = {};
    },

    destroy: function () {
        this._super();
        $(window).off(this.fileupload_id);
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * Compute the URL of an attachment.
     *
     * @private
     * @param {Object} attachment
     * @returns {string} URL of the attachment
     */
    _getFileUrl: function (attachment) {
        // return '/web/content/' + attachment.id + '?download=true';
        return '/web/content/' + attachment.id;
    },
    /**
     * Process the field data to add some information (url, etc.).
     *
     * @private
     */
    _generatedMetadata: function () {
        var self = this;
        _.each(this.value.data, function (record) {
            // tagging `allowUnlink` ascertains if the attachment was user
            // uploaded or was an existing or system generated attachment
            self.metadata[record.id] = {
                allowUnlink: self.uploadedFiles[record.data.id] || false,
                url: self._getFileUrl(record.data),
            };
        });
    },
    /**
     * @private
     * @override
     */
    _render: function () {
        // render the attachments ; as the attachments will changes after each
        // _setValue, we put the rendering here to ensure they will be updated

        this._generatedMetadata();
        this.$('.oe_placeholder_files, .o_attachments')
            .replaceWith($(qweb.render(this.template_files, {
                widget: this,
            })));
        this.$('.oe_fileupload').show();

        this.$('.o_image[data-mimetype^="image"]').each(function () {
            var $img = $(this);
            if (/gif|jpe|jpg|png/.test($img.data('mimetype')) && $img.data('src')) {
                $img.css('background-image', "url('" + $img.data('src') + "')");
            }
        });
    },

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * @private
     */
    _onAttach: function () {
        // This widget uses a hidden form to upload files. Clicking on 'Attach'
        // will simulate a click on the related input.
        this.$('.o_input_file').click();
    },
    /**
     * @private
     * @param {MouseEvent} ev
     */
    _onDelete: function (ev) {
        ev.preventDefault();
        ev.stopPropagation();

        var fileID = $(ev.currentTarget).data('id');
        var record = _.findWhere(this.value.data, {res_id: fileID});
        if (record) {
            this._setValue({
                operation: 'FORGET',
                ids: [record.id],
            });
            var metadata = this.metadata[record.id];
            if (!metadata || metadata.allowUnlink) {
                this._rpc({
                    model: 'ir.attachment',
                    method: 'unlink',
                    args: [record.res_id],
                });
            }
        }
    },
    /**
     * @private
     * @param {Event} ev
     */
    _onFileChanged: function (ev) {
        var self = this;
        ev.stopPropagation();

        var files = ev.target.files;
        var attachment_ids = this.value.res_ids;

        // Don't create an attachment if the upload window is cancelled.
        if(files.length === 0)
            return;

        _.each(files, function (file) {
            var record = _.find(self.value.data, function (attachment) {
                return attachment.data.name === file.name;
            });
            if (record) {
                var metadata = self.metadata[record.id];
                if (!metadata || metadata.allowUnlink) {
                    // there is a existing attachment with the same name so we
                    // replace it
                    attachment_ids = _.without(attachment_ids, record.res_id);
                    self._rpc({
                        model: 'ir.attachment',
                        method: 'unlink',
                        args: [record.res_id],
                    });
                }
            }
            self.uploadingFiles.push(file);
        });

        this._setValue({
            operation: 'REPLACE_WITH',
            ids: attachment_ids,
        });

        this.$('form.o_form_binary_form').submit();
        this.$('.oe_fileupload').hide();
        ev.target.value = "";
    },
    /**
     * @private
     */
    _onFileLoaded: function () {
        var self = this;
        // the first argument isn't a file but the jQuery.Event
        var files = Array.prototype.slice.call(arguments, 1);
        // files has been uploaded, clear uploading
        this.uploadingFiles = [];

        var attachment_ids = this.value.res_ids;
        _.each(files, function (file) {
            if (file.error) {
                self.displayNotification({ title: _t('Uploading Error'), message: file.error, type: 'danger' });
            } else {
                attachment_ids.push(file.id);
                self.uploadedFiles[file.id] = true;
            }
        });

        this._setValue({
            operation: 'REPLACE_WITH',
            ids: attachment_ids,
        });
    },

    _previewAttachment: function(ev) {
        ev.stopPropagation();
        ev.preventDefault();
        var self = this;
        var activeAttachmentID = $(ev.currentTarget).data('id');
        this._rpc({
            model: 'ir.attachment',
            method: 'read_as_sudo',
            kwargs: {
                domain: [['id', 'in', this.value.res_ids]],
                fields: ['id', 'name', 'mimetype', 'index_content'],
            },
        }).then(result => {
            this.attachments = result.map(r => {
                return {
                    id: r.id,
                    name: r.name,
                    mimetype: r.mimetype,
                    fileType: r.index_content
                }
            });
            var attachmentViewer = new DocumentViewer(this, this.attachments, activeAttachmentID);
            attachmentViewer.appendTo($('body'));
        })
    }
});

registry.add("many2many_pdf_preview", FieldMany2ManyAttachmentPreview);

})