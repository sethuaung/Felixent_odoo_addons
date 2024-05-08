# -*- coding: utf-8 -*-
from odoo import models, api, _


class IrAttachment(models.Model):
	_inherit = "ir.attachment"
	
	@api.model
	def read_as_sudo(self, domain=None, fields=None):
		return self.sudo().search_read(domain, fields)
