/** @odoo-module */

import { NavBar } from "@web/webclient/navbar/navbar";
import { registry } from "@web/core/registry";
const { fuzzyLookup } = require('@web/core/utils/search');
import { computeAppsAndMenuItems } from "@web/webclient/menus/menu_helpers";
import core from 'web.core';
const { onMounted } = owl.hooks;
import { patch } from 'web.utils';
var rpc = require('web.rpc');

patch(NavBar.prototype, 'responsive_web/static/src/components/apps_menu/apps_menu.js', {
    /**
     * @override
     */
     setup() {
        this._super();
        this._search_def = $.Deferred();
        let { apps, menuItems } = computeAppsAndMenuItems(this.menuService.getMenuAsTree("root"));
        this._apps = apps;
        this._searchableMenus = menuItems;
        onMounted(this.onMounted);
    },
    onMounted() {
        this.$search_container = $(".search-container");
        this.$search_input = $(".search-input input");
        this.$search_results = $(".search-results");
        this.$app_menu = $(".app-menu");
    },
     _searchMenusSchedule: function () {
        this.$search_results.removeClass("o_hidden")
        this.$app_menu.addClass("o_hidden");
        this._search_def.reject();
        this._search_def = $.Deferred();
        setTimeout(this._search_def.resolve.bind(this._search_def), 50);
        this._search_def.done(this._searchMenus.bind(this));
    },
    _searchMenus: function () {
        var query = this.$search_input.val();
        if (query === "") {
            this.$search_container.removeClass("has-results");
            this.$app_menu.removeClass("o_hidden");
            this.$search_results.empty();
            return;
        }
        var results = [];
        fuzzyLookup(query, this._apps, (menu) => menu.label)
        .forEach((menu) => {
            results.push({
                category: "apps",
                name: menu.label,
                actionID: menu.actionID,
                id: menu.id,
                webIconData: menu.webIconData,
            });
        });
        fuzzyLookup(query, this._searchableMenus, (menu) =>
            (menu.parents + " / " + menu.label).split("/").reverse().join("/")
        ).forEach((menu) => {
            results.push({
                category: "menu_items",
                name: menu.parents + " / " + menu.label,
                actionID: menu.actionID,
                id: menu.id,
            });
        });        this.$search_container.toggleClass(
            "has-results",
            Boolean(results.length)
        );
        this.$search_results.html(
            core.qweb.render(
                "responsive_web.SearchResults",
                {
                    results: results,
                    widget: this,
                }
            )
        );
    },
    OnClickMainMenu() {
        if ($('.app_components').css("display") === "none") {
            $('.app_components').fadeIn(250);
            $('.o_menu_sections').attr('style','display: none !important');
            $('.o_menu_brand').attr('style','display: none !important');
        } else {
            $('.app_components').fadeOut(250);
            $('.o_menu_sections').attr('style','display: flex !important');
            $('.o_menu_brand').attr('style','display: block !important');
        }
    },
    onNavBarDropdownItemSelection(menu){
        if (menu.detail) {
            return this._super(...arguments)
        }
        else {
            $('.app_components').css("display","none");
            $('.o_menu_sections').attr('style','display: flex !important');
            const payload = menu
            const ev = {detail: {payload}}
            return this._super(ev);
        }
    }
});
