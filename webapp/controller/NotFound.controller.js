sap.ui.define([
	"dbag/crm/btx/ssc/controller/BaseController"
	], function (BaseController) {
		"use strict";

		return BaseController.extend("dbag.crm.btx.ssc.controller.NotFound", {

			onInit: function () {
				this.getRouter().getTarget("notFound").attachDisplay(this._onNotFoundDisplayed, this);
			},

			_onNotFoundDisplayed : function () {
					this.getModel("appView").setProperty("/layout", "OneColumn");
			}
		});
	}
);