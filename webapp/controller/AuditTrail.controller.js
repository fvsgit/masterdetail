sap.ui.define([
	"dbag/crm/btx/ssc/controller/BaseController"
], function (Controller) {
	"use strict";

	return Controller.extend("dbag.crm.btx.ssc.controller.AuditTrail", {
		onInit: function () {

			Controller.prototype.onInit.apply(this, arguments);
			this._getRouter().attachRouteMatched(this._onRouteMatched.bind(this));
		},

		_onRouteMatched: function (oEvent) {

			var sObjectId = oEvent.getParameter("arguments").objectId;
			this.getModel("appView").setProperty("/layout", "TwoColumnsMidExpanded");

			this._bindView(sObjectId).then(function () {
				this.byId("idAuditTrailTable").getBinding("items").refresh(true);
			}.bind(this));
		},

		/** 
		 * Navigates user back to the worklist.
		 */
		onPress_NavigateBack: function () {
			var self = this;
			this._showPendingChangesWarning().then(function () {
				self._getRouter().navTo("case", {
					caseId: self._get("caseId"),
					parent: self._get("parent")
				});
			});
		},

		/**
		 * Set the full screen mode to false and navigate to master page
		 */
		onCloseDetailPress: function () {
			this.getModel("appView").setProperty("/actionButtonsInfo/midColumn/fullScreen", false);
			// No item should be selected on master after detail page is closed
			this.getOwnerComponent().oListSelector.clearMasterListSelection();
			this.getRouter().navTo("master");
		},

		/**
		 * Toggle between full and non full screen mode.
		 */
		toggleFullScreen: function () {
			var bFullScreen = this.getModel("appView").getProperty("/actionButtonsInfo/midColumn/fullScreen");
			this.getModel("appView").setProperty("/actionButtonsInfo/midColumn/fullScreen", !bFullScreen);
			if (!bFullScreen) {
				// store current layout and go full screen
				this.getModel("appView").setProperty("/previousLayout", this.getModel("appView").getProperty("/layout"));
				this.getModel("appView").setProperty("/layout", "MidColumnFullScreen");
			} else {
				// reset to previous layout
				this.getModel("appView").setProperty("/layout", this.getModel("appView").getProperty("/previousLayout"));
			}
		},

		parseFloat: function (sString) {
			return parseFloat(sString);
		},

		onPress_lnkControlPlan: function () {
			//Check that the ushell container service is available
			if (sap.ushell && sap.ushell.Container && sap.ushell.Container.getService) {

				//Get an instance of the cross application navigator service
				var oCrossAppNavigator = sap.ushell.Container.getService("CrossApplicationNavigation");

				//Navigate to the external application
				oCrossAppNavigator.toExternal({
					target: {
						semanticObject: "ZCRM_COM_KYC_CP",
						action: "display"
					},
					params: {
						ControlPlanGuid: this.getView().getBindingContext().getProperty("ControlPlanGuid")
					}
				});
			} else {
				jQuery.sap.log.info("Cannot Navigate - Application Running Standalone");
			}

		},

		_bindView: function (sObjectId) {
			var self = this;
			var oModel = self._getModel();
			var sKey = oModel.createKey("FollowUpActions", {
				FuaGuid: sObjectId
			});
			return Promise.all([
				new Promise(function (resolve) {

					oModel.metadataLoaded().then(function () {

						this.getView().bindElement({
							path: "/" + sKey,
							events: {
								dataRequested: function () {
									oModel.metadataLoaded().then(function () {
										// Busy indicator on view should only be set if metadata is loaded,
										// otherwise there may be two busy indications next to each other on the
										// screen. This happens because route matched handler already calls '_bindView'
										// while metadata is loaded.
										self.getView().setBusy(true);
									});
								},
								dataReceived: function () {
									self.getView().setBusy(false);
									resolve();
								}
							}
						});

					}.bind(this));
				}.bind(this))
			]);
		}

	});
});