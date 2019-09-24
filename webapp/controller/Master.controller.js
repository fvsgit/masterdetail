/*global history */
sap.ui.define([
	"dbag/crm/btx/ssc/controller/BaseController",
	"sap/ui/model/json/JSONModel",
	"sap/ui/core/routing/History",
	"sap/ui/model/Filter",
	"sap/ui/model/Sorter",
	"sap/ui/model/FilterOperator",
	"sap/m/GroupHeaderListItem",
	"sap/ui/Device",
	"dbag/crm/btx/ssc/model/formatter",
	"sap/m/MessageBox"
], function (BaseController, JSONModel, History, Filter, Sorter, FilterOperator, GroupHeaderListItem, Device, formatter, MessageBox) {
	"use strict";

	return BaseController.extend("dbag.crm.btx.ssc.controller.Master", {

		formatter: formatter,

		/* =========================================================== */
		/* lifecycle methods                                           */
		/* =========================================================== */

		/**
		 * Called when the master list controller is instantiated. It sets up the event handling for the master/detail communication and other lifecycle tasks.
		 * @public
		 */
		onInit: function () {

			// Keeps reference to any of the created sap.m.ViewSettingsDialog-s in this sample
			this._mViewSettingsDialogs = {};

			// Control state model
			var oList = this.byId("list"),
				oViewModel = this._createViewModel(),
				// Put down master list's original value for busy indicator delay,
				// so it can be restored later on. Busy handling on the master list is
				// taken care of by the master list itself.
				iOriginalBusyDelay = oList.getBusyIndicatorDelay();

			this._oList = oList;
			// keeps the filter and search state
			this._oListFilterState = {
				filters: undefined
			};

			this.setModel(oViewModel, "masterView");
			// Make sure, busy indication is showing immediately so there is no
			// break after the busy indication for loading the view's meta data is
			// ended (see promise 'oWhenMetadataIsLoaded' in AppController)
			oList.attachEventOnce("updateFinished", function () {
				// Restore original busy indicator delay for the list
				oViewModel.setProperty("/delay", iOriginalBusyDelay);
			});

			this.getView().addEventDelegate({
				onBeforeFirstShow: function () {
					this.getOwnerComponent().oListSelector.setBoundMasterList(oList);
				}.bind(this)
			});

			this.getRouter().getRoute("master").attachPatternMatched(this._onMasterMatched, this);
			this.getRouter().attachBypassed(this.onBypassed, this);

		},

		onExit: function () {
			var oDialogKey,
				oDialogValue;

			for (oDialogKey in this._mViewSettingsDialogs) {
				oDialogValue = this._mViewSettingsDialogs[oDialogKey];

				if (oDialogValue) {
					oDialogValue.destroy();
				}
			}
		},

		/* =========================================================== */
		/* event handlers                                              */
		/* =========================================================== */

		/**
		 * After list data is available, this handler method updates the
		 * master list counter
		 * @param {sap.ui.base.Event} oEvent the update finished event
		 * @public
		 */
		onUpdateFinished: function (oEvent) {
			// update the master list object counter after new data is loaded
			this._updateListItemCount(oEvent.getParameter("total"));
		},

		onSearch: function (oEvent) {

			if (oEvent.getParameters().refreshButtonPressed) {
				// Search field's 'refresh' button has been pressed.
				// This is visible if you select any master list item.
				// In this case no new search is triggered, we only
				// refresh the list binding.
				this.onRefresh();
				return;
			}

			//Clear any filters
			this._oListFilterState.aSearch = [];

			//Get the entered search string
			var sQuery = oEvent.getParameter("query");

			//Set the filters
			this._oListFilterState.filters = this._getFilters(sQuery);

			//apply the filters
			this._applyFilters();
		},

		onPressFilter: function () {
			var oDialog = this.createViewSettingsDialog("dbag.crm.btx.ssc.view.dialog.FilterDialog");
			this.getView().addDependent(oDialog); 

			oDialog.open();
		},

		onPressSort: function () {
			var oDialog = this.createViewSettingsDialog("dbag.crm.btx.ssc.view.dialog.SortDialog");
			this.getView().addDependent(oDialog); 

			oDialog.open();
		},

		onPressSortConfirm: function (oEvent) {
			var oList = this.byId("list"),
				mParams = oEvent.getParameters(),
				oBinding = oList.getBinding("items"),
				sPath,
				bDescending,
				aSorters = [];

			sPath = mParams.sortItem.getKey();
			bDescending = mParams.sortDescending;
			aSorters.push(new Sorter("Group", true, true));
			aSorters.push(new Sorter(sPath, bDescending));

			// apply the selected sort and group settings
			oBinding.sort(aSorters);
		},

		onPressFilterConfirm: function (oEvent) {
			var oList = this.byId("list"),
				mParams = oEvent.getParameters(),
				oBinding = oList.getBinding("items"),
				aFilters = [];

			mParams.filterItems.forEach(function (oItem) {
				var aSplit = oItem.getKey().split("___"),
					sPath = aSplit[0],
					sOperator = aSplit[1],
					sValue1 = aSplit[2],
					sValue2 = aSplit[3],
					oFilter = new Filter(sPath, sOperator, sValue1, sValue2);
				aFilters.push(oFilter);
			});

			// apply filter settings
			oBinding.filter(aFilters); 
		},

		/**
		 * Event handler for refresh event. Keeps filter, sort
		 * and group settings and refreshes the list binding.
		 * @public
		 */
		onRefresh: function () {
			this._oList.getBinding("items").refresh();
		},

		// /**
		//  * Event handler for the list selection event
		//  * @param {sap.ui.base.Event} oEvent the list selectionChange event
		//  * @public
		//  */
		// onSelectionChange: function (oEvent) {
		// 	var oList = oEvent.getSource(),
		// 		bSelected = oEvent.getParameter("selected");

		// 	// skip navigation when deselecting an item in multi selection mode
		// 	if (!(oList.getMode() === "MultiSelect" && !bSelected)) {
		// 		// get the list item, either from the listItem parameter or from the event's source itself (will depend on the device-dependent mode).
		// 		this._showDetail(oEvent.getParameter("listItem") || oEvent.getSource());
		// 	}
		// },

		onListItemPress: function (oEvent) {
			this._showDetail(oEvent.getParameter("listItem") || oEvent.getSource());
		},

		/**
		 * Event handler for the bypassed event, which is fired when no routing pattern matched.
		 * If there was an object selected in the master list, that selection is removed.
		 * @public
		 */
		onBypassed: function () {
			this._oList.removeSelections(true);
		},

		/**
		 * Event handler for navigating back.
		 * It there is a history entry or an previous app-to-app navigation we go one step back in the browser history
		 * If not, it will navigate to the shell home
		 * @public
		 */
		onNavBack: function () {
			var sPreviousHash = History.getInstance().getPreviousHash(),
				oCrossAppNavigator = sap.ushell.Container.getService("CrossApplicationNavigation");

			if (sPreviousHash !== undefined || !oCrossAppNavigator.isInitialNavigation()) {
				history.go(-1);
			} else {
				oCrossAppNavigator.toExternal({
					target: {
						shellHash: "#Shell-home"
					}
				});
			}
		},

		onSelectFilter: function (oEvent) {

			//Clear the search box 
			this.getView().byId("searchField").setValue("");

			//Navigate to the master view with the filter
			this.getRouter().navTo("master", {
				filter: oEvent.getParameter("selectedKey")
			}, true);

		},

		onPressNew: function () {
			//Navigate to the master view with the filter
			this.getRouter().navTo("create", {
				filter: this.getModel("masterView").getProperty("/filter")
			}, false);
		},

		/* =========================================================== */
		/* begin: internal methods                                     */
		/* =========================================================== */

		_getFilters: function (sQuery) {

			var aSearchFieldFilter = [];
			var sSearchString = "";

			//Check if the user typed something in the search box
			if (sQuery !== undefined && sQuery.length >= 1) {
				sSearchString = sQuery;
			}

			//Add the filter on the objectId and Description based on the entered search string
			aSearchFieldFilter.push(new Filter("ObjectId", FilterOperator.Contains, sSearchString));
			aSearchFieldFilter.push(new Filter("Title", FilterOperator.Contains, sSearchString));

			//Combine the two filters with an OR
			var oSearchFilter = new Filter({
				filters: aSearchFieldFilter,
				and: false
			});

			//Create a filter for the request type
			var bIsChangeRequest = false;
			if (this.getModel("masterView").getProperty("/filter") === ":changeRequests:") {
				bIsChangeRequest = true;
			}
			var oTypeFilter = new Filter("ChangeRequest", FilterOperator.EQ, bIsChangeRequest);

			//Combine all the filters with an AND
			return new Filter({
				filters: [oSearchFilter, oTypeFilter],
				and: true
			});

		},
		_createViewModel: function () {
			return new JSONModel({
				delay: 0,
				title: "",
				noDataText: this.getResourceBundle().getText("msgNoData"),
				filter: "incidents",
				previousGuid: null,
				newGuid: null
			});
		},

		_onMasterMatched: function () {

			//Set the layout property of the FCL control to 'OneColumn'
			this.getModel("appView").setProperty("/layout", "OneColumn");

			//Refresh the binding of the list
			//	this._oList.getBinding("items").refresh();

			var sFilterKey = arguments[0].getParameter("arguments").filter;
			if (sFilterKey !== undefined) {
				this.getModel("masterView").setProperty("/filter", sFilterKey);
				this._setTitle();
				this._oListFilterState.filters = this._getFilters(this.getView().byId("searchField").getValue());
				this._applyFilters();
			}

		},

		/**
		 * Shows the selected item on the detail page
		 * On phones a additional history entry is created
		 * @param {sap.m.ObjectListItem} oItem selected Item
		 * @private
		 */
		_showDetail: function (oItem) {

			var sNewGuid = oItem.getBindingContext().getObject().Guid;
			this.getModel("masterView").setProperty("/newGuid", sNewGuid);

			var sPreviousGuid = this.getModel("masterView").getProperty("/previousGuid");

			if (sPreviousGuid !== null) {
				if (this.getModel().hasPendingChanges()) {
					MessageBox.show(this.getText("msgDataLoss"), {
						icon: MessageBox.Icon.WARNING,
						title: this.getText("titDataLoss"),
						actions: [MessageBox.Action.YES, MessageBox.Action.NO],
						onClose: this.onDataLossClose.bind(this)
					});
				} else {
					this._routeToDetail();
				}
			} else {
				this._routeToDetail();
			}
		},

		_routeToDetail: function () {

			var sNewGuid = this.getModel("masterView").getProperty("/newGuid");
			this.getModel("masterView").setProperty("/previousGuid", sNewGuid);

			var bReplace = !Device.system.phone;
			// set the layout property of FCL control to show two columns
			this.getModel("appView").setProperty("/layout", "TwoColumnsMidExpanded");
			this.getRouter().navTo("object", {
				guid: sNewGuid
			}, bReplace);
		},

		onDataLossClose: function (oAction) {

			if (oAction === MessageBox.Action.YES) {
				this.getModel().resetChanges();
				this._routeToDetail();
			} else {
				var sPreviousGuid = this.getModel("masterView").getProperty("/previousGuid");
				this.getModel("masterView").setProperty("/newGuid", sPreviousGuid);
				this.getModel("masterView").setProperty("/previousGuid", null);

				var sPath = this.getModel().createKey("Tickets", {
					Guid: sPreviousGuid
				});

				this.getOwnerComponent().oListSelector.selectAListItem("/" + sPath);
				this._routeToDetail();
			}
		},

		/**
		 * Sets the item count on the master list header
		 * @param {integer} iTotalItems the total number of items in the list
		 * @private
		 */
		_updateListItemCount: function (iTotalItems) {
			// only update the counter if the length is final
			if (this._oList.getBinding("items").isLengthFinal()) {

				var sTitle = null;
				var oSelectedFilter = this.getModel("masterView").getProperty("/filter");
				if (oSelectedFilter === ":incidents:") {
					sTitle = this.getText("masterTitleCount", [this.getText("titIncidents"), iTotalItems]);
				} else if (oSelectedFilter === ":changeRequests:") {
					sTitle = this.getText("masterTitleCount", [this.getText("titChangeRequests"), iTotalItems]);
				}

				this.getModel("masterView").setProperty("/title", sTitle);
			}
		},

		_setTitle: function () {
			var sTitle = null;
			var iCount = this._oList.getBinding("items").getLength();
			var oSelectedFilter = this.getModel("masterView").getProperty("/filter");
			if (oSelectedFilter === ":incidents:") {
				sTitle = this.getText("masterTitleCount", [this.getText("titIncidents"), iCount]);
			} else if (oSelectedFilter === ":changeRequests:") {
				sTitle = this.getText("masterTitleCount", [this.getText("titChangeRequests"), iCount]);
			}

			this.getModel("masterView").setProperty("/title", sTitle);
		},

		/**
		 * Internal helper method to apply both filter and search state together on the list binding
		 * @private
		 */
		_applyFilters: function () {
			var oFilters = this._oListFilterState.filters;
			var oViewModel = this.getModel("masterView");
			this._oList.getBinding("items").filter(oFilters, "Application");
			// changes the noDataText of the list in case there are no filter results
			if (oFilters !== undefined) {
				oViewModel.setProperty("/noDataText", this.getResourceBundle().getText("masterListNoDataWithFilterOrSearchText"));
			} else if (this._oListFilterState.aSearch.length > 0) {
				// only reset the no data text to default when no new search was triggered
				oViewModel.setProperty("/noDataText", this.getResourceBundle().getText("masterListNoDataText"));
			}
		},
		getListGroupHeader: function (group) {
			return new GroupHeaderListItem({
				title: group.key,
				upperCase: false
			});
		},

		createViewSettingsDialog: function (sDialogFragmentName) {
			var oDialog = this._mViewSettingsDialogs[sDialogFragmentName];

			if (!oDialog) {
				oDialog = sap.ui.xmlfragment(sDialogFragmentName, this);
				this._mViewSettingsDialogs[sDialogFragmentName] = oDialog;

				if (Device.system.desktop) {
					oDialog.addStyleClass("sapUiSizeCompact");
				}
			}
			return oDialog;
		}

	});

});