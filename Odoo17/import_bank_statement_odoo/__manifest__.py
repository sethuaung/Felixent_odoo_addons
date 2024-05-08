# -*- coding: utf-8 -*-
###############################################################################
#
#    Cybrosys Technologies Pvt. Ltd.
#
#    Copyright (C) 2024-TODAY Cybrosys Technologies(<https://www.cybrosys.com>)
#    Author: Akhil Ashok (odoo@cybrosys.com)
#
#    You can modify it under the terms of the GNU LESSER
#    GENERAL PUBLIC LICENSE (LGPL v3), Version 3.
#
#    This program is distributed in the hope that it will be useful,
#    but WITHOUT ANY WARRANTY; without even the implied warranty of
#    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
#    GNU LESSER GENERAL PUBLIC LICENSE (LGPL v3) for more details.
#
#    You should have received a copy of the GNU LESSER GENERAL PUBLIC LICENSE
#    (LGPL v3) along with this program.
#    If not, see <http://www.gnu.org/licenses/>.
#
###############################################################################
{
    'name': 'Import Bank Statement Odoo17',
    'version': '17.0.1.0.0',
    'category': 'Accounting',
    'summary': 'Odoo 17 Account Bank Statement Import, Import Bank Statement,CSV, XLSX, OFX, QIF Statements Import, Odoo 17 Accounting, Odoo17, Bank Statements, Import Statement Files',
    'description': """Odoo 17 Account Bank Statement Import, CSV, XLSX, OFX, QIF Statements Import, Odoo 17 Accounting, Odoo17, Bank Statements""",
    'author': "Cybrosys Techno Solutions",
    'company': 'Cybrosys Techno Solutions',
    'maintainer': 'Cybrosys Techno Solutions',
    'website': "https://www.cybrosys.com",
    'depends': ['base', 'base_accounting_kit'],
    'data': ['security/ir.model.access.csv',
             'views/account_journal_views.xml',
             'wizard/import_bank_statement_views.xml'],
    'external_dependencies': {
        'python': ['openpyxl', 'ofxparse']
    },
    'images': ['static/description/banner.jpg'],
    'license': 'LGPL-3',
    'installable': True,
    'auto_install': False,
    'application': False,
}
