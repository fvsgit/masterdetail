/*global location */
sap.ui.define([
	"dbag/crm/btx/ssc/controller/BaseController",
	"sap/ui/model/json/JSONModel",
	"dbag/crm/btx/ssc/model/formatter",
	"sap/ui/model/Filter",
	"sap/ui/model/FilterOperator",
	"sap/m/UploadCollectionParameter",
	"sap/m/MessageBox",
	"dbag/crm/btx/ssc/control/UploadCollection"
], function (BaseController, JSONModel, formatter, Filter, FilterOperator, UploadCollectionParameter, MessageBox, UploadCollection) {
	"use strict";

	return BaseController.extend("dbag.crm.btx.ssc.controller.Create", {

		formatter: formatter,

		/* =========================================================== */
		/* lifecycle methods                                           */
		/* =========================================================== */

		onInit: function () {

			//Attach to the pattern matched event for the route
			this.getRouter().getRoute("create").attachPatternMatched(this._onObjectMatched, this);
		},

		/* =========================================================== */
		/* event handlers                                              */
		/* =========================================================== */

		onChangeFirstCategory: function () {
			var sFirstCategoryId = this.getModel("ViewModel").getProperty("/FirstCategoryId");
			this._clearCategoryValueStates();

			//Also unbind the second and third category, and reset the control status as the values will change
			var oSecondCategory = this.getView().byId("selSecondCategory");
			oSecondCategory.unbindAggregation("items");
			this.getModel("ViewModel").setProperty("/SecondCategoryEnabled", false);
			this.getModel("ViewModel").setProperty("/SecondCategoryId", "");

			var oThirdCategory = this.getView().byId("selThirdCategory");
			oThirdCategory.unbindAggregation("items");
			this.getModel("ViewModel").setProperty("/ThirdCategoryEnabled", false);
			this.getModel("ViewModel").setProperty("/ThirdCategoryId", "");

			if (sFirstCategoryId !== undefined) {
				if (sFirstCategoryId !== "") {
					this._bindSecondCategory(sFirstCategoryId);
					this._bindPriorities(sFirstCategoryId);
				} else {

					var oPrioritySelect = this.getView().byId("selPriority");
					oPrioritySelect.unbindItems();
					this.getModel("ViewModel").setProperty("/PriorityEnabled", false);

					var oSecondCategorySelect = this.getView().byId("selSecondCategory");
					var oBlank = new sap.ui.core.Item({
						key: "",
						text: ""
					});

					if (oSecondCategorySelect !== undefined) {

						this.getModel("ViewModel").setProperty("/SecondCategoryEnabled", false);
						oSecondCategorySelect.insertItem(oBlank);
						oSecondCategorySelect.setSelectedKey("");
						oSecondCategorySelect.setSelectedItem(oBlank);

					}
				}
			}
		},
		onChangeSecondCategory: function () {
			var sSecondCategoryId = this.getModel("ViewModel").getProperty("/SecondCategoryId");
			this._clearCategoryValueStates();

			//Also unbind the third category, and reset the control status as the values will change 
			var oThirdCategory = this.getView().byId("selThirdCategory");
			oThirdCategory.unbindAggregation("items");
			this.getModel("ViewModel").setProperty("/ThirdCategoryEnabled", false);
			this.getModel("ViewModel").setProperty("/ThirdCategoryId", "");

			if (sSecondCategoryId !== undefined) {
				if (sSecondCategoryId !== "") {
					this._bindThirdCategory(sSecondCategoryId);
				} else {
					var oThirdCategorySelect = this.getView().byId("selThirdCategory");
					var oBlank = new sap.ui.core.Item({
						key: "",
						text: ""
					});

					if (oThirdCategorySelect !== undefined) {

						this.getModel("ViewModel").setProperty("/ThirdCategoryEnabled", false);
						oThirdCategorySelect.insertItem(oBlank);
						oThirdCategorySelect.setSelectedKey("");
						oThirdCategorySelect.setSelectedItem(oBlank);

					}
				}
			}
		},

		onPressSave: function () {

			//Validate the input screen
			if (this._validateCategories() && this._validateControlName("frmMain")) {

				var bValid = true
				var bCustomFields = this.getView().getModel("CustomFields").getProperty("/showAdditionalFields");
				if (bCustomFields) {
					bValid = this._validateControlName("frmAdditionalFields");
				}

				if (bValid) {

					var sCategory = this.getModel("ViewModel").getProperty("/Category").toLowerCase();
					sap.m.MessageBox.confirm(this.getText("msgConfirmCreate", [sCategory]), {
						icon: MessageBox.Icon.QUESTION,
						title: this.getText("titConfirmation"),
						actions: [MessageBox.Action.YES, MessageBox.Action.NO],
						onClose: this.onCloseConfirmSave.bind(this)
					});
				}
			}
		},

		_validateCategories: function () {

			var oFirstCategory = this.getView().byId("selFirstCategory");
			var oSecondCategory = this.getView().byId("selSecondCategory");
			var oThirdCategory = this.getView().byId("selThirdCategory");
			var bValid = false;

			this._clearCategoryValueStates();

			if (this.getModel("ViewModel").getProperty("/FirstCategoryId") !== "") {
				if (this.getModel("ViewModel").getProperty("/SecondCategoryId") !== "") {
					if (this.getModel("ViewModel").getProperty("/ThirdCategoryId") !== "") {
						bValid = true;
					} else {
						oThirdCategory.setValueState("Error");
					}
				} else {
					oSecondCategory.setValueState("Error");
				}
			} else {
				oFirstCategory.setValueState("Error");
			}
			return bValid;
		},

		_clearCategoryValueStates: function () {
			var oFirstCategory = this.getView().byId("selFirstCategory");
			var oSecondCategory = this.getView().byId("selSecondCategory");
			var oThirdCategory = this.getView().byId("selThirdCategory");

			oSecondCategory.setValueState("None");
			oFirstCategory.setValueState("None");
			oThirdCategory.setValueState("None");
		},

		onCloseConfirmSave: function (oAction) {

			if (oAction === MessageBox.Action.YES) {

				//Get the view model data
				var oModel = this.getModel("ViewModel");
				var oModelData = oModel.getData();

				oModel.setProperty("/busy", true);

				var oPayload = {
					CategoryId: oModelData.ThirdCategoryId,
					Title: oModelData.Title,
					Description: oModelData.Description,
					PriorityId: oModelData.PriorityId,
					PriorityReason: oModelData.PriorityReason,
					ChangeRequest: oModelData.ChangeRequest,
					AdditionalInformation: oModelData.AdditionalInformation
				};

				this.getModel().create("/Tickets", oPayload, {
					success: this._ticketCreationSuccess.bind(this),
					error: this._ticketCreationFailed.bind(this)
				});

			}
		},

		onPressCancel: function () {

			MessageBox.show(this.getText("msgDataLossCreate"), {
				icon: MessageBox.Icon.Warning,
				title: this.getText("titDataLoss"),
				actions: [MessageBox.Action.YES, MessageBox.Action.NO],
				onClose: this._onClose.bind(this)
			});

		},

		onChangeUploadColletion: function (oEvent) {

		},
		onBeforeUploadStarts: function (oEvent) {

			var oCustomerHeaderToken = new UploadCollectionParameter({
				name: "x-csrf-token",
				value: this.getModel().getSecurityToken()
			});
			oEvent.getParameters().addHeaderParameter(oCustomerHeaderToken);

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

			var sUploadedFileName = oEvent.getParameter("files")[0].fileName;

			for (var i = 0; i < this.UploadCollection.getItems().length; i++) {
				if (this.UploadCollection.getItems()[i].getFileName() === sUploadedFileName) {
					this.UploadCollection.removeItem(this.UploadCollection.getItems()[i]);
					break;
				}
			}

			this.getModel("ViewModel").setProperty("/busy", false);

			//Navigate to the new object that was created
			this.getRouter().navTo("object", {
				guid: this.getModel("ViewModel").getProperty("/newGuid")
			}, true);
		},

		onPriorityBindingChange: function (oEvent) {

			this.getModel("ViewModel").setProperty("/PriorityEnabled", false);

			var oPrioritySelect = this.getView().byId("selPriority");
			if (oPrioritySelect !== undefined) {

				var aItems = oPrioritySelect.getItems();
				if (aItems.length >= 1) {

					var sFirstKey = oPrioritySelect.getItems()[0].getProperty("key");
					oPrioritySelect.setSelectedKey(sFirstKey);
					this.getModel("ViewModel").setProperty("/PriorityId", sFirstKey);
					this.getModel("ViewModel").setProperty("/PriorityEnabled", true);

				} else {
					MessageBox.error(this.getText("msgErrorLoadingPriorities"));
				}
			} else {
				MessageBox.error(this.getText("msgErrorLoadingPriorities"));
			}
		},

		/* =========================================================== */
		/* begin: internal methods                                     */
		/* =========================================================== */

		_updateFileCounterTitle: function () {
			this.getModel("ViewModel").setProperty("/TotalFiles", this.getText("titTotalFiles", [this.byId("upcAttachments").getItems().length +
				1
			]));
		},
		_onClose: function (oAction) {
			if (oAction === MessageBox.Action.YES) {
				this.onNavBack();
			}
		},

		_ticketCreationSuccess: function (oData) {

			//Store the created ticket in the view model
			this.getModel("ViewModel").setProperty("/newGuid", oData.Guid);

			var oCustomFields = this.getModel("CustomFields").getData();
			var aPromises = [];
			if (oCustomFields.showAdditionalFields) {
				oCustomFields.fields.map(function (field) {
					aPromises.push(this._createAdditionalField(oData.Guid, field));
				}.bind(this));
			}

			Promise.all(aPromises).then(function () {

				//Now perform the upload of the files
				if (this.UploadCollection.getItems().length >= 1) {

					var sPath = this.getModel().createKey("Tickets", {
						Guid: oData.Guid
					});

					this.UploadCollection.setUploadUrl("/sap/opu/odata/sap/ZUHD_MAINT_SRV/" + sPath + "/Attachments");
					this.UploadCollection.upload();

				} else {

					this.getModel("ViewModel").setProperty("/busy", false);

					//Navigate to the new object that was created
					this.getRouter().navTo("object", {
						guid: this.getModel("ViewModel").getProperty("/newGuid")
					}, true);
				}
				
			}.bind(this), function () {
				MessageBox.error(this.getText("msgErrorSavingData"));
			}.bind(this)); 
		},

		_createAdditionalField: function (sGuid, sField) {

			return new Promise(function (resolve, reject) {

				this.getModel().create("/AdditionalFields", {
					Guid: sGuid,
					AdditionalFieldId: sField,
					Value: this.getModel("CustomFields").getProperty("/" + sField)
				}, {
					success: resolve,
					error: reject
				});

			}.bind(this));
		},

		_ticketCreationFailed: function () {
			this.getModel("ViewModel").setProperty("/busy", false);
		},

		/**
		 * Binds the view to the object path and expands the aggregated line items.
		 * @function
		 * @param {sap.ui.base.Event} oEvent pattern match event in route 'object'
		 * @private
		 */
		_onObjectMatched: function (oEvent) {

			//Create a view model that will be used to capture the entered data
			this._createModels();

			//Clear value states of all previously validated controls
			this._clearValueStates();

			//Set the layout propperties
			this.getModel("appView").setProperty("/layout", "MidColumnFullScreen");

			var sFilterKey = arguments[0].getParameter("arguments").filter;
			if (sFilterKey === ":incidents:") {
				this.getModel("ViewModel").setProperty("/Category", "Incident");
				this.getModel("ViewModel").setProperty("/ChangeRequest", false);
				this.getView().byId("txtPrioInfo").setVisible(true);
			} else {
				this.getModel("ViewModel").setProperty("/Category", "Change Request");
				this.getModel("ViewModel").setProperty("/ChangeRequest", true);
				this.getView().byId("txtPrioInfo").setVisible(false);
			}

			//Setup the upload collection
			this._setupUploadCollection();

			//Bind the view with data
			this._bindView();
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
		_bindView: function () {

			//Unbind all priorities as this will be determined base on the first category that gets selected
			this.getView().byId("selPriority").unbindItems();

			//Bind the select control for the first category. Once the binding of 
			//the first category is done, it will start the binding of the second
			//category.
			this._bindFirstCategory();

			//Bind additional fields. These fields are configured in the backend an needs to be created 
			//dynamically during runtime
			this._bindAdditionalFields(true);
		},

		_bindCategory: function (sControlId, aFilters, oChangeCallBack) {

			//Get the view model
			var oViewModel = this.getModel("ViewModel");

			//Get the select control for the first category
			var oCategoryControl = this.getView().byId(sControlId);

			//Check if the control was found
			if (oCategoryControl !== undefined) {

				//Create a template for the items of the select
				var oTemplate = new sap.ui.core.Item({
					key: "{CategoryId}",
					text: "{CategoryDesc}"
				});

				//Bind the items for the select
				oCategoryControl.bindItems({
					path: "/Categories",
					filters: aFilters,
					template: oTemplate,
					events: {
						change: oChangeCallBack,
						dataRequested: function () {
							oViewModel.setProperty("/busy", true);
						},
						dataReceived: function (oData) {
							oViewModel.setProperty("/busy", false);
						}
					}
				});
			} else {
				MessageBox.error(this.getText("msgErrorLoadingCategories"));
			}

		},

		_bindFirstCategory: function () {

			var aFilter = [];
			if (this.getModel("ViewModel").getProperty("/ChangeRequest")) {
				aFilter = [new Filter("CategoryDesc", FilterOperator.Contains, "SAP")];
			}
			this._bindCategory("selFirstCategory", aFilter, this._firstCategoryBindingChange.bind(this));
		},

		_bindSecondCategory: function (sParentID) {
			this._bindCategory(
				"selSecondCategory", [new Filter("ParentCategoryId", FilterOperator.EQ, sParentID)],
				this._secondCategoryBindingChange.bind(this));
		},
		_bindThirdCategory: function (sParentID) {
			this._bindCategory(
				"selThirdCategory", [new Filter("ParentCategoryId", FilterOperator.EQ, sParentID)],
				this._thirdCategoryBindingChange.bind(this));
		},

		_bindPriorities: function (sCategoryId) {

			//Create a template for the items of the select
			var oTemplate = new sap.ui.core.Item({
				key: "{PriorityId}",
				text: "{PriorityDesc}"
			});

			var oPriorities = this.getView().byId("selPriority");
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

		_firstCategoryBindingChange: function () {

			//Get the select control for the first category
			var oFirstCategorySelect = this.getView().byId("selFirstCategory");
			var oBlank = new sap.ui.core.Item({
				key: "",
				text: ""
			});

			if (oFirstCategorySelect !== undefined) {

				var bFirstCategoryEnabled = false;
				if (!this.getModel("ViewModel").getProperty("/ChangeRequest")) {
					oFirstCategorySelect.insertItem(oBlank);
					bFirstCategoryEnabled = true;
				}

				this.getModel("ViewModel").setProperty("/FirstCategoryEnabled", bFirstCategoryEnabled);

				oFirstCategorySelect.setSelectedKey("");
				oFirstCategorySelect.setSelectedItem(oBlank);

				//Get the bound items of the first category
				var aItems = oFirstCategorySelect.getItems();
				if (aItems !== undefined && aItems.length >= 1) {

					//Get the key of the first item in the list and set the selected key to this
					var sFirstKey = aItems[0].getProperty("key");
					if (sFirstKey !== undefined) {
						if (sFirstKey !== "") {

							//Set the selected key of the first category
							oFirstCategorySelect.setSelectedKey(sFirstKey);
							this.getModel("ViewModel").setProperty("/FirstCategoryId", sFirstKey);

							//Bind the second category select by filtering the list based on the first category
							this._bindSecondCategory(sFirstKey);
							this._bindPriorities(sFirstKey);

						}
					} else {
						MessageBox.error(this.getText("msgErrorLoadingCategories"));
					}
				} else {
					MessageBox.error(this.getText("msgErrorLoadingCategories"));
				}
			} else {
				MessageBox.error(this.getText("msgErrorLoadingCategories"));
			}
		},
		_secondCategoryBindingChange: function () {

			//Get the select control for the second category
			var oSecondCategorySelect = this.getView().byId("selSecondCategory");
			var oBlank = new sap.ui.core.Item({
				key: "",
				text: ""
			});
			if (oSecondCategorySelect !== undefined) {

				oSecondCategorySelect.insertItem(oBlank);
				oSecondCategorySelect.setSelectedKey("");
				oSecondCategorySelect.setSelectedItem(oBlank);

				//Get the bound items of the second category
				var aItems = oSecondCategorySelect.getItems();
				if (aItems !== undefined && aItems.length >= 1) {

					//Get the key of the first item in the list and set the selected key to this
					var sFirstKey = aItems[0].getProperty("key");
					if (sFirstKey !== undefined) {

						//Set the data in the data model
						oSecondCategorySelect.setSelectedKey(sFirstKey);
						this.getModel("ViewModel").setProperty("/SecondCategoryId", sFirstKey);
						this.getModel("ViewModel").setProperty("/SecondCategoryEnabled", true);

					} else {
						MessageBox.error(this.getText("msgErrorLoadingCategories"));
						this.getModel("ViewModel").setProperty("/SecondCategoryEnabled", false);
					}

				} else {
					this.getModel("ViewModel").setProperty("/SecondCategoryEnabled", false);
					MessageBox.error(this.getText("msgErrorLoadingCategories"));
				}
			} else {
				MessageBox.error(this.getText("msgErrorLoadingCategories"));
				this.getModel("ViewModel").setProperty("/SecondCategoryEnabled", false);
			}

		},

		_thirdCategoryBindingChange: function () {

			//Hide the third category by default
			this.getModel("ViewModel").setProperty("/ThirdCategoryEnabled", false);
			this.getModel("ViewModel").setProperty("/ThirdCategoryVisible", false);

			//Get the select control for the third category
			var oThirdCategorySelect = this.getView().byId("selThirdCategory");
			var oBlank = new sap.ui.core.Item({
				key: "",
				text: ""
			});
			if (oThirdCategorySelect !== undefined) {

				if (oThirdCategorySelect.getItems().length > 1) {
					oThirdCategorySelect.insertItem(oBlank);
					oThirdCategorySelect.setSelectedKey("");
					oThirdCategorySelect.setSelectedItem(oBlank);
				}

				//Get the bound items of the third category
				var aItems = oThirdCategorySelect.getItems();
				if (aItems !== undefined && aItems.length >= 1) {

					//Get the key of the first item in the list and set the selected key to this
					var sFirstKey = aItems[0].getProperty("key");
					if (sFirstKey !== undefined) {

						//Set the data in the data model
						oThirdCategorySelect.setSelectedKey(sFirstKey);
						this.getModel("ViewModel").setProperty("/ThirdCategoryId", sFirstKey);

						if (aItems.length > 1) {
							this.getModel("ViewModel").setProperty("/ThirdCategoryVisible", true);
							this.getModel("ViewModel").setProperty("/ThirdCategoryEnabled", true);
						}

					} else {
						MessageBox.error(this.getText("msgErrorLoadingCategories"));
					}

				} else {
					MessageBox.error(this.getText("msgErrorLoadingCategories"));
				}
			} else {
				MessageBox.error(this.getText("msgErrorLoadingCategories"));
			}

		},

		_setupUploadCollection: function () {

			//Create a variable to hold the reference to the upload collection control
			this.UploadCollection = new UploadCollection({
				maximumFilenameLength: 55,
				maximumFileSize: 10,
				multiple: true,
				showSeparators: "All",
				instantUpload: false,
				change: this.onChangeUploadColletion.bind(this),
				beforeUploadStarts: this.onBeforeUploadStarts.bind(this),
				uploadComplete: this.onUploadComplete.bind(this)
			});

			//Get the container that will hold the upload collection and destroy any existing items
			var oContainer = this.getView().byId("vbxFiles");
			oContainer.destroyItems();

			//Add the upload collection to the container
			oContainer.addItem(this.UploadCollection);
		},

		_createModels: function () {

			// Model used to manipulate control states. The chosen values make sure,
			// detail page is busy indication immediately so there is no break in
			// between the busy indication for loading the view's meta data
			var oViewModel = new JSONModel({
				busy: false,
				delay: 0,
				FirstCategoryId: "",
				SecondCategoryId: "",
				ThirdCategoryId: "",
				SecondCategoryEnabled: false,
				ThirdCategoryEnabled: false,
				ThirdCategoryVisible: false,
				PriorityEnabled: false,
				Title: "",
				Description: "",
				PriorityId: "",
				PriorityReason: "",
				AdditionalInformation: "",
				TotalFiles: this.getText("titTotalFiles", [0]),
				highInfo: this.getText("txtHighInfo"),
				mediumInfo: this.getText("txtMediumInfo"),
				lowInfo: this.getText("txtLowInfo"),
				Category: "",
				ChangeRequest: false
			}, true);

			//Set the model to the view
			this.getView().setModel(oViewModel, "ViewModel");
		}
	});

});