/*global history */
sap.ui.define([
	"sap/ui/core/mvc/Controller",
	"sap/ui/core/routing/History",
	"dbag/sapui5/utils/FieldValidator",
	"sap/ui/model/json/JSONModel"
], function (Controller, History, FieldValidator, JSONModel) {
	"use strict";

	return Controller.extend("dbag.crm.btx.ssc.controller.BaseController", {

		RequestStatus: {
			Test: 1
		},

		/**
		 * Convenience method for accessing the router in every controller of the application.
		 * @public
		 * @returns {sap.ui.core.routing.Router} the router for this component
		 */
		getRouter: function () {
			return this.getOwnerComponent().getRouter();
		},

		/**
		 * Convenience method for getting the view model by name in every controller of the application.
		 * @public
		 * @param {string} sName the model name
		 * @returns {sap.ui.model.Model} the model instance
		 */
		getModel: function (sName) {
			return this.getView().getModel(sName);
		},

		/**
		 * Convenience method for setting the view model in every controller of the application.
		 * @public
		 * @param {sap.ui.model.Model} oModel the model instance
		 * @param {string} sName the model name
		 * @returns {sap.ui.mvc.View} the view instance
		 */
		setModel: function (oModel, sName) {
			return this.getView().setModel(oModel, sName);
		},

		/**
		 * Convenience method for getting the resource bundle.
		 * @public
		 * @returns {sap.ui.model.resource.ResourceModel} the resourceModel of the component
		 */
		getResourceBundle: function () {
			return this.getOwnerComponent().getModel("i18n").getResourceBundle();
		},

		getText: function (sMsgName, aParameters) {
			var sMsgText = "";
			//Check if any parameters were passed
			if (aParameters && aParameters.length >= 1) {
				//Get the message text from the i18n model and substitute the parameters
				sMsgText = this.getResourceBundle().getText(sMsgName, aParameters);
			} else {
				//Get the message text from the i18n model
				sMsgText = this.getResourceBundle().getText(sMsgName);
			}
			//Return the generated message text
			return sMsgText;
		},

		/**
		 * Event handler for navigating back.
		 * It there is a history entry or an previous app-to-app navigation we go one step back in the browser history
		 * If not, it will replace the current entry of the browser history with the master route.
		 * @public
		 */
		onNavBack: function () {
			var sPreviousHash = History.getInstance().getPreviousHash(),
				oCrossAppNavigator = sap.ushell.Container.getService("CrossApplicationNavigation");

			if (sPreviousHash !== undefined || !oCrossAppNavigator.isInitialNavigation()) {
				history.go(-1);
			} else {
				this.getRouter().navTo("master", {}, true);
			}
		},

		_refactor10digitId: function (oFilter) {
			var iLength = oFilter.oValue1.length;
			if (iLength > 0) {
				for (var i = 0; i < 10 - iLength; i++) {
					oFilter.oValue1 = "0" + oFilter.oValue1;
				}
			}
			return oFilter;
		},

		_validateControlName: function (sControlName) {
			return this._validate(this.getView().byId(sControlName));
		},

		_validateRichTextToolbarStatus: function (oControl) {
			if (oControl.getContent()[0] !== undefined) {
				return false;
			}
			return true;
		},

		_validate: function (subject) {
			//removed function cause error state is set on each control individually
			//moved from Validator.js due to possible looping of Validator.validate function
			var validator = new FieldValidator();

			if (typeof subject === 'string' || subject instanceof String || subject instanceof Array) {
				// it's a string or an array
				var aControls = sap.ui.getCore().byFieldGroupId(subject);
				if (aControls && aControls.length > 0) {

					var bValid = true;
					for (var i = 0; i < aControls.length; i++) {
						if (!validator.validate(aControls[i])) {
							bValid = false;
						}
					}
					return bValid;
				} else {
					console.error("no controls found for subject ");
					console.error(subject);
					return null;
				}
			} else {

				return validator.validate(subject);
			}
		},

		_bindAdditionalFields: function (bCreateNew) {

			//Call the function import to get the custom fields the current user is allowed to complete
			this.getView().getModel().callFunction("/GetCustomFields", {
				method: "GET",
				success: this._customFieldsRead.bind(this, bCreateNew),
				error: this._customFieldsReadFailed.bind(this)
			});

		},

		_customFieldsRead: function (bCreateNew, oData) {

			//Create a JSON model that will hold the values of the custom fields. Also add it to the view
			var oModel = new JSONModel({
				showAdditionalFields: false,
				fields: []
			});
			oModel.attachPropertyChange(this.customFieldChanged, this);

			this.getView().setModel(oModel, "CustomFields");

			//Only get the bound context if the call comes from the detail view
			if (!bCreateNew) {
				//Get the current ticket guid
				var sGuid = this.getView().getBindingContext().getObject().Guid;
			}

			//Get the form where the fields should be added
			var oForm = this.getView().byId("frmAdditionalFields");
			oForm.destroyContent();

			if (oData.results && oData.results.length >= 1) {

				//Enable the section that will show the additional fields 
				this.getView().getModel("CustomFields").setProperty("/showAdditionalFields", true);

				//Create an input field on the form for each returned custom field
				oData.results.map(function (field) {

					//Create a property in the model for the current field
					this.getView().getModel("CustomFields").setProperty("/" + field.FieldId, "");

					//Get the array that holds all the fieldIds that are already added to the screen.
					var aFields = this.getView().getModel("CustomFields").getProperty("/fields");
					//Add the new field and save it in the model
					aFields.push(field.FieldId);
					this.getView().getModel("CustomFields").setProperty("/fields", aFields);

					oForm.addContent(new sap.m.Label({
						text: field.FieldLabel,
						required: field.Required
					}));
					oForm.addContent(new sap.m.Input({
						value: "{CustomFields>/" + field.FieldId + "}",
						required: field.Required
					}));

					//Only bind the new field to existing values in the model if the field is on the detail view
					if (!bCreateNew) {
						//Now set the value of the field in the model if there is an existing value
						this._setCustomFieldValue(sGuid, field.FieldId);
					}

				}.bind(this));

				//Once all the fields are created and the data has been set in the case of the the detail view,
				//store a copy of the current state of the model that can bu used later for comparison
				this.CustomFields_OriginalState = JSON.stringify(this.getModel("CustomFields").getData());
			}

		},

		customFieldChanged: function(){
			this.getModel("appModel").setProperty("/customFieldsChanged", this.CustomFields_OriginalState !== JSON.stringify(this.getModel("CustomFields").getData())); 
		},

		_setCustomFieldValue: function (sGuid, sFieldId) {

			var sPath = this.getModel().createKey("/AdditionalFields", {
				Guid: sGuid,
				AdditionalFieldId: sFieldId
			});

			var oField = this.getView().getModel().getProperty(sPath);
			if (oField) {
				this.getModel("CustomFields").setProperty("/" + sFieldId, oField.Value);
			}

		},

		_customFieldsReadFailed: function () {

			sap.m.MessageBox.error(this.getText("msgCustomFieldsReadFailed"), {
				title: this.getText("titDataReadError")
			});

		}

	});

});