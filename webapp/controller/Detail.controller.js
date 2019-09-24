/*global location */
sap.ui.define([
	"dbag/crm/btx/ssc/controller/BaseController",
	"sap/ui/model/json/JSONModel",
	"dbag/crm/btx/ssc/model/formatter",
	"sap/m/MessageToast",
	"sap/m/MessageBox",
	"sap/m/UploadCollectionParameter",
	"sap/ui/model/Filter"
], function (BaseController, JSONModel, formatter, MessageToast, MessageBox, UploadCollectionParameter, Filter) {
	"use strict";

	return BaseController.extend("dbag.crm.btx.ssc.controller.Detail", {

		formatter: formatter,

		/* =========================================================== */
		/* lifecycle methods                                           */
		/* =========================================================== */

		onInit: function () {
			// Model used to manipulate control states. The chosen values make sure,
			// detail page is busy indication immediately so there is no break in
			// between the busy indication for loading the view's meta data
			var oViewModel = new JSONModel({
				busy: false,
				delay: 0,
				readyToSave: false,
				newComment: "",
				highInfo: this.getText("txtHighInfo"),
				mediumInfo: this.getText("txtMediumInfo"),
				lowInfo: this.getText("txtLowInfo"),
				jiraUrl: "",
				jiraIssues: false,
				originalStatus: ""
			});

			this.getRouter().getRoute("object").attachPatternMatched(this._onObjectMatched, this);
			this.setModel(oViewModel, "detailView");
			this.getOwnerComponent().getModel().metadataLoaded().then(this._onMetadataLoaded.bind(this));
		},

		/* =========================================================== */
		/* event handlers                                              */
		/* =========================================================== */

		onPressSave: function () {

			//Validate the input screen
			if (this._validateControlName("frmMain")) {

				var bValid = true
				var bCustomFields = this.getView().getModel("CustomFields").getProperty("/showAdditionalFields");
				if (bCustomFields) {
					bValid = this._validateControlName("frmAdditionalFields");
				}

				if (bValid) {

					//Create an array to hold all the promises that will save the data
					var aPromises = [];

					//Check if the are changes in the the odata model. If there are changes, add an entry in the promise array 
					aPromises.push(this._submitChanges());

					//Check if there are changes in the custom fields model. If there are changes, add an entry in the promise array 
					aPromises = aPromises.concat(this._submitCustomFieldChanges());

					//Now save all changes
					Promise.all(aPromises).then(function () {
						this._saveSuccess();
					}.bind(this), function () {
						this._saveError();
					}.bind(this));

				}

			}
		},

		_submitChanges: function () {

			return new Promise(function (resolve, reject) {

				if (this.getModel().hasPendingChanges()) {
					this.getView().getModel().submitChanges({
						success: function () {
							resolve();
						}.bind(this),
						error: function () {
							reject();
						}.bind(this)
					});
				} else {
					resolve();
				}

			}.bind(this));
		},

		onPressUndo: function () {

			//Reset the odata model
			this.getModel().resetChanges();
			this.getModel("appModel").setProperty("/hasPendingChanges", false);

			if (this.getModel("CustomFields").getProperty("/showAdditionalFields")) {
				//Reset the custom fields model
				this.getModel("CustomFields").setData(JSON.parse(this.CustomFields_OriginalState));
				this.getModel("appModel").setProperty("/customFieldsChanged", false);
			}

		},

		onChangeUploadColletion: function (oEvent) {

			var oUploadCollection = oEvent.getSource();
			var oCustomerHeaderToken = new UploadCollectionParameter({
				name: "x-csrf-token",
				value: this.getModel().getSecurityToken()
			});
			oUploadCollection.addHeaderParameter(oCustomerHeaderToken);
		},
		onBeforeUploadStarts: function (oEvent) {

			var oSlug = {
				fileName: oEvent.getParameter("fileName")
			};
			var sSlug = encodeURIComponent(JSON.stringify(oSlug));
			var oCustomerHeaderSlug = new UploadCollectionParameter({
				name: "slug",
				value: sSlug
			});
			oEvent.getParameters().addHeaderParameter(oCustomerHeaderSlug);
		},
		onUploadComplete: function (oEvent) {
			this.byId("upcAttachments").getBinding("items").refresh();
		},
		onPressDownload: function (oEvent) {
			var oSource = oEvent.getSource();
			var oContext = oSource.getBindingContext();
			var oObject = oContext.getObject();

			var sDownloadPath = this.getModel().createKey("Attachments", {
				AttachmentGuid: oObject.AttachmentGuid,
				IncidentGuid: oObject.IncidentGuid
			});

			window.open(this.getModel().sServiceUrl + "/" + sDownloadPath + "/$value");
		},

		onPressAddComment: function () {

			//Create an instance of the file dialog if it does not exist
			if (!this._commentDialog || this._commentDialog === null) {
				this._commentDialog = sap.ui.xmlfragment("dbag.crm.btx.ssc.view.dialog.Comment", this);
			}

			//Set the model for the dialog 
			this.getModel("detailView").setProperty("/readyToSave", false);
			this.getModel("detailView").setProperty("/newComment", "");
			this.getView().addDependent(this._commentDialog);

			//Show the dialog
			this._commentDialog.open();

		},

		onPressCancelComment: function () {
			if (this._commentDialog) {
				this._commentDialog.close();
			}
		},

		onLiveChangeComment: function (oEvent) {
			var sNewValue = oEvent.getParameter("newValue");
			var bReadyToSave = false;
			if (sNewValue !== undefined && sNewValue.length >= 1) {
				bReadyToSave = true;
			}
			this.getModel("detailView").setProperty("/readyToSave", bReadyToSave);
		},

		onPressSaveComment: function () {

			//Set the busy indicator on the dialog
			this._commentDialog.setBusy(true);

			//Get the binding context
			var oBindingContext = this.getView().getBindingContext();
			if (oBindingContext !== undefined) {

				//Construct the payload that should be sent to the backend
				var oPayload = {
					Guid: oBindingContext.getObject().Guid,
					CommentText: this.getModel("detailView").getProperty("/newComment")
				};

				var sPath = oBindingContext.getPath() + "/Comments";
				if (sPath && sPath.length > 0) {
					this.getModel().create(sPath, oPayload, {
						success: this._successCommentSave.bind(this),
						error: this._errorCommentsSave.bind(this)
					});
				} else {
					MessageBox.error(this.getText("msgErrorSavingComment"));
				}
			} else {
				MessageBox.error(this.getText("msgErrorSavingComment"));
			}
		},

		onPressAddWatchers: function (oEvent) {

			//Create an instance of the watchers dialog if it does not exist
			if (!this._watchersDialog || this._watchersDialog === null) {
				this._watchersDialog = sap.ui.xmlfragment("dbag.crm.btx.ssc.view.dialog.AddWatchersDialog", this);
			}

			//Set the model for the dialog 
			/*		this.getModel("detailView").setProperty("/readyToSave", false);
					this.getModel("detailView").setProperty("/newComment", "");*/
			this.getView().addDependent(this._watchersDialog);

			//Show the dialog
			this._watchersDialog.open();
		},

		onDeleteWatcher: function (oEvent) {
			this.getModel().remove(oEvent.getParameter("listItem").getBindingContext().getPath(), {
				success: this.onSuccessWatcherDelete.bind(this),
				error: this.onErrorWatcherDelete.bind(this)
			});
		},

		onSuccessWatcherDelete: function () {
			MessageToast.show(this.getText("updatedWatchers"));
		},

		onErrorWatcherDelete: function () {
			MessageBox.error(this.getText("errorDeletingWatcher"));
		},

		onDeleteCurrentUserAsWatcher: function () {
			var bCompact = !!this.getView().$().closest(".sapUiSizeCompact").length;
			sap.m.MessageBox.confirm(
				this.getText("confirmWatcherRemove"), {
				styleClass: bCompact ? "sapUiSizeCompact" : "",
				actions: [sap.m.MessageBox.Action.YES, sap.m.MessageBox.Action.NO],
				onClose: function (oEvent) {
					if (oEvent === sap.m.MessageBox.Action.YES) {

						this.getModel().callFunction("/Unwatch", {
							method: "POST",
							urlParameters: {
								Guid: this.getView().getBindingContext().getObject().Guid
							},
							success: function () {
								MessageBox.success(this.getText("removedWatcher"), {
									onClose: function () {
										this.getRouter().navTo("master");
									}.bind(this)
								});
							}.bind(this),
							error: function () {
								MessageBox.error(this.getText("errorRemovingWatcher"));
							}.bind(this)
						});
					}
				}.bind(this)
			}
			);
		},

		onFileDeleted: function (oEvent) {
			var oModel = this.getModel();
			var oBindingContext = oEvent.getParameter("item").getBindingContext();
			var sPath = oBindingContext.sPath;

			var encodeUrl = encodeURI(sPath + "/$value");

			oModel.remove(
				encodeUrl, {
				success: function (oData, oResponse) {

				},
				error: function (oError) {

				}
			}
			);
		},

		onSearchWatchers: function (oEvent) {
			var sValue = oEvent.getParameter("value");
			var oFilter = new Filter("FullName", sap.ui.model.FilterOperator.Contains, sValue);
			var oBinding = oEvent.getSource().getBinding("items");
			oBinding.filter([oFilter]);
		},

		onConfirmWatchers: function (oEvent) {
			var aContexts = oEvent.getParameter("selectedContexts");
			if (aContexts && aContexts.length) {
				for (var i = 0; i < aContexts.length; i++) {
					var oWatcher = aContexts[i].getObject();
					this.getModel().create("/Watchers", {
						Guid: this.getView().getBindingContext().getObject().Guid,
						PartnerId: oWatcher.PartnerId
					}, {
						success: this.onSuccessWatcherCreate.bind(this),
						error: this.onErrorWatcherCreate.bind(this)
					});
				}
			} else {
				MessageToast.show(this.getText("noWatchersAdded"));
			}

			//Clear the filter that was applied to the items
			oEvent.getSource().getBinding("items").filter([]);
		},

		onCancelWatchers: function (oEvent) {
			//Clear the filter that was applied to the items	
			oEvent.getSource().getBinding("items").filter([]);
		},

		onSuccessWatcherCreate: function () {
			MessageToast.show(this.getText("updatedWatchers"));
		},

		onErrorWatcherCreate: function () {
			MessageBox.error(this.getText("errorAddingWatcher"));
		},
		/* =========================================================== */
		/* begin: internal methods                                     */
		/* =========================================================== */

		_successCommentSave: function () {
			this._commentDialog.setBusy(false);
			this._commentDialog.close();
			MessageToast.show(this.getText("msgCommentAdded"));
		},
		_errorCommentsSave: function () {
			this._commentDialog.setBusy(false);
			this._commentDialog.close();
			MessageBox.error(this.getText("msgErrorSavingComment"));
		},
		_saveSuccess: function (oData) {

			//Store the original status in the view model so that we can use this for enabling and disabling fields
			//We do not want a change in the staus to impact these rules
			this.getModel("detailView").setProperty("/originalStatus", this.getView().getBindingContext().getObject().StatusId);
			MessageToast.show(this.getText("msgDataSaved"));
		},

		_submitCustomFieldChanges: function () {

			var aPromises = [];

			if (this.getModel("appModel").getProperty("/customFieldsChanged")) {

				//Get the guid of the current ticket
				var sGuid = this.getView().getBindingContext().getObject().Guid;

				//Loop though all the fields on the screen and save the values
				var aFields = this.getView().getModel("CustomFields").getProperty("/fields");
				aFields.map(function (field) {

					var sValue = this.getModel("CustomFields").getProperty("/" + field);
					var sPath = this.getModel().createKey("/AdditionalFields", {
						Guid: sGuid,
						AdditionalFieldId: field
					});

					aPromises.push(this._updateCustomField(sPath, { Value: sValue }));

				}.bind(this));

			}

			return aPromises;

		},

		_updateCustomField: function (sPath, oData) {

			return new Promise(function (resolve, reject) {

				this.getModel().update(sPath, oData, {
					success: function () {
						resolve();
					}.bind(this),
					error: function () {
						reject();
					}.bind(this)
				});

			}.bind(this));

		},

		_saveError: function () {
			MessageBox.error(this.getText("msgErrorSavingData"));
		},

		/**
		 * Binds the view to the object path and expands the aggregated line items.
		 * @function
		 * @param {sap.ui.base.Event} oEvent pattern match event in route 'object'
		 * @private
		 */
		_onObjectMatched: function (oEvent) {
			var sGuid = oEvent.getParameter("arguments").guid;
			this.getModel("appView").setProperty("/layout", "TwoColumnsMidExpanded");
			this.getModel().metadataLoaded().then(function () {
				var sObjectPath = this.getModel().createKey("Tickets", {
					Guid: sGuid
				});
				this._bindView("/" + sObjectPath);
			}.bind(this));
		},

		_clearValueStates: function () {
			this.getView().byId("inpTitle").setValueState(sap.ui.core.ValueState.None);
			this.getView().byId("txtPriorityReason").setValueState(sap.ui.core.ValueState.None);
		},

		/**
		 * Binds the view to the object path. Makes sure that detail view displays
		 * a busy indicator while data for the corresponding element binding is loaded.
		 * @function
		 * @param {string} sObjectPath path to the object to be bound to the view.
		 * @private
		 */
		_bindView: function (sObjectPath) {
			// Set busy indicator during view binding
			var oViewModel = this.getModel("detailView");

			// If the view was not bound yet its not busy, only if the binding requests data it is set to busy again
			oViewModel.setProperty("/busy", false);

			//Create an array to keep all the expands
			var aExpand = [
				"Status",
				"Priority",
				"Watchers",
				"Watchers/Employee",
				"AddtionalField"
			];

			//Create a string for the expand parameter
			var sExpand = aExpand.join(",");

			this.getView().bindElement({
				path: sObjectPath,
				parameters: {
					expand: sExpand
				},
				events: {
					change: this._onBindingChange.bind(this),
					dataRequested: function () {
						oViewModel.setProperty("/busy", true);
					},
					dataReceived: function (oData) {
						oViewModel.setProperty("/busy", false);
					}.bind(this)
				}
			});
		},

		_onBindingChange: function () {
			var oView = this.getView(),
				oElementBinding = oView.getElementBinding();

			// No data for the binding
			if (!oElementBinding.getBoundContext()) {
				this.getRouter().getTargets().display("detailObjectNotFound");
				// if object could not be found, the selection in the master list
				// does not make sense anymore.
				this.getOwnerComponent().oListSelector.clearMasterListSelection();
				return;
			}

			var sPath = oElementBinding.getPath();
			this.getOwnerComponent().oListSelector.selectAListItem(sPath);

			//Get the current binding context
			var oContext = this.getView().getBindingContext();
			if (oContext !== undefined && oContext !== null) {

				//Bind the priority dropdown based on the category of the ticket
				this._bindPriorities(oContext.getObject().CategoryId);

				//Bind the priority dropdown based on the category of the ticket
				this._bindPriorities(oContext.getObject().CategoryId);

				//Store the original status in the view model so that we can use this for enabling and disabling fields
				//We do not want a change in the staus to impact these rules
				this.getModel("detailView").setProperty("/originalStatus", oContext.getObject().StatusId);

				//Set a property in the view model that shows if the user is a watcher or not for the current request
				this.getModel("detailView").setProperty("/watcher", oContext.getObject().Group === "Watchlist");

				//Check if the current item is a CR
				var bChangeRequest = oContext.getObject().ChangeRequest;
				if (bChangeRequest !== undefined && bChangeRequest) {
					this.getView().getModel("detailView").setProperty("/titlePrefix", this.getText("titChangeRequest"));
				} else {
					this.getView().getModel("detailView").setProperty("/titlePrefix", this.getText("titIncident"));
				}

				//Also set the upload URL for the UploadColletion 
				this.byId("upcAttachments").setUploadUrl("/sap/opu/odata/sap/ZUHD_MAINT_SRV" + sPath + "/Attachments");

				//Bind additional fields. These fields are configured in the backend an needs to be created 
				//dynamically during runtime
				this._bindAdditionalFields(false);

			}
			this.getModel().read(sPath + "/JiraIssues", {
				success: this._createJiraUrl.bind(this)
			});
		},

		_createJiraUrl: function (oData) {
			var sUrl;
			this.getModel("detailView").setProperty("/jiraIssues", false);

			if (oData !== undefined && oData.results !== undefined && oData.results.length !== 0) {
				if (oData.results.length >= 2) {
					sUrl = "https://jiradbg.deutsche-boerse.de/issues/?jql=";
					oData.results.map(function (oJiraIssue) {
						sUrl += "key=" + oJiraIssue.JiraIssueId + " OR ";
					});
					sUrl = sUrl.substring(0, sUrl.length - 4);
				} else {
					sUrl = "https://jiradbg.deutsche-boerse.de/browse/";
					sUrl += oData.results[0].JiraIssueId;
				}
				this.getModel("detailView").setProperty("/jiraIssues", true);
				this.getModel("detailView").setProperty("/jiraUrl", sUrl);
			}
		},

		_onMetadataLoaded: function () {
			// Store original busy indicator delay for the detail view
			var iOriginalViewBusyDelay = this.getView().getBusyIndicatorDelay(),
				oViewModel = this.getModel("detailView");

			// Make sure busy indicator is displayed immediately when
			// detail view is displayed for the first time
			oViewModel.setProperty("/delay", 0);

			// Binding the view will set it to not busy - so the view is always busy if it is not bound
			oViewModel.setProperty("/busy", true);
			// Restore original busy indicator delay for the detail view
			oViewModel.setProperty("/delay", iOriginalViewBusyDelay);
		},

		_bindPriorities: function (sCategoryId) {

			//Create a template for the items of the select
			var oTemplate = new sap.ui.core.Item({
				key: "{PriorityId}",
				text: "{PriorityDesc}"
			});

			var oPriorities = this.getView().byId("selPriority");
			oPriorities.setBusyIndicatorDelay(100);
			oPriorities.setBusy(true);
			oPriorities.bindItems({
				path: "/Priorities",
				parameters: {
					custom: {
						search: sCategoryId
					}
				},
				template: oTemplate,
				events: {
					change: this.onPriorityBindingChange.bind(this)
				}

			});
		},

		onPriorityBindingChange: function (oEvent) {
			this.getView().byId("selPriority").setBusy(false);
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
		}
	});

});