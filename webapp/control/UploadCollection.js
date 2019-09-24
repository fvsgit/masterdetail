sap.ui.define([
	"sap/m/UploadCollection"
	// "sap/base/Log"
], function (UploadCollection) {
	"use strict";

	//Create and extended object of the UploadCollection
	return UploadCollection.extend("dbag.crm.btx.ssc.control.UploadCollection", {

		setUploadUrl: function (sUploadUrl) {
			if (this.getUploadUrl() !== sUploadUrl) {
				this.setProperty("uploadUrl", sUploadUrl);
				this._getFileUploader().setUploadUrl(sUploadUrl);
			}
			return this;
		},

		upload: function () {

			var iFileUploadersCounter = this._aFileUploadersForPendingUpload.length;
			for (var i = 0; i < iFileUploadersCounter; i++) {
				this._aFileUploadersForPendingUpload[i].setUploadUrl(this.getUploadUrl());
			}

			UploadCollection.prototype.upload.apply(this, arguments);
		}

	});

});