/**
 *
 * HostedFeatureServiceUtils
 *  - Utility to help create a hosted Feature Layer
 *
 * Author:   John Grayson - Applications Prototype Lab - Esri
 * Created:  09/27/2017 - 0.0.2 -
 * Modified: 10/10/2017 - 0.0.3 - updated to JS API 4.5 and using esri.core.Accessor
 * Modified: 10/18/2017 - 0.0.4 - updated to include attachments
 * Modified: 10/27/2017 - 0.0.5 - updated to to better handle service names
 *
 */
define([
  "esri/core/Accessor",
  "esri/core/Evented",
  "dojo/_base/lang",
  "dojo/on",
  "dojo/dom",
  "dojo/dom-class",
  "dojo/dom-construct",
  "dojo/Deferred",
  "dojo/promise/all",
  "esri/identity/IdentityManager",
  "esri/core/promiseUtils",
  "esri/core/lang",
  "esri/request",
  "esri/Graphic",
  "esri/layers/Layer",
  "esri/layers/FeatureLayer",
  "esri/geometry/geometryEngine",
  "esri/geometry/support/webMercatorUtils"
], function (Accessor, Evented, lang, on, dom, domClass, domConstruct, Deferred, all,
             IdentityManager, promiseUtils, esriLang, esriRequest,
             Graphic, Layer, FeatureLayer, geometryEngine, webMercatorUtils) {

  const HostedFeatureServiceUtils = Accessor.createSubclass([Evented], {

    declaredClass: "apl.HostedFeatureServiceUtils",

    properties: {
      portal: {
        value: null
      },
      featureUploadCount: {
        value: 100
      }
    },

    /**
     *
     * @param step
     * @param messageText
     * @param isError
     */
    updateMessage: function (step, messageText, isError) {
      this.emit("message", { step: step, message: messageText, isError: (isError == null) ? false : isError });
      if(isError) {
        console.error(messageText)
      }
    },

    /**
     *
     * @param createParameters
     * @param createParameters.templateFeatureLayerItemId
     * @param createParameters.sourceFeatureLayer
     * @param createParameters.destinationFolderId
     * @param createParameters.attachmentInfos
     * @param createParameters.resizeOption
     * @returns {*}
     */
    createHostedFeatureLayer: function (createParameters) {
      const deferred = new Deferred();

      // UPLOAD ERROR //
      const onUploadError = (error) => {
        if(!error) {
          error = new Error("Unknown error...");
        }
        this.updateMessage(-1, JSON.stringify(error), true);
        deferred.reject(error);
      };

      if(createParameters.templateFeatureLayerItemId == null) {
        onUploadError(new Error("Missing 'templateFeatureLayerItemId' parameter"));
        return;
      }

      if(createParameters.sourceFeatureLayer == null) {
        onUploadError(new Error("Missing 'sourceFeatureLayer' parameter"));
        return;
      }

      // ARE WE SIGNED IN //
      if(this.portal && this.portal.user) {

        Layer.fromPortalItem({ portalItem: { id: createParameters.templateFeatureLayerItemId } }).then((templateFeatureLayer) => {
          templateFeatureLayer.load().then(() => {

            // SOURCE FEATURE LAYER //
            const sourceFeatureLayer = createParameters.sourceFeatureLayer;

            // EXTENT OF ALL FEATURES //
            const featuresExtentUnion = geometryEngine.union(sourceFeatureLayer.source.toArray().map((sourceFeature) => {
              return sourceFeature.geometry;
            }));
            const featuresExtent = featuresExtentUnion.extent;

            // COPY SOURCE SERVICE AND LAYER //
            this.updateMessage(1, "Getting source layer details...");
            this._copyServiceSchema(templateFeatureLayer).then((sourceServiceInfo) => {

              // CREATE NEW HOSTED FEATURE SERVICE //
              this.updateMessage(2, "Creating new hosted service...");
              this._createFeatureService(sourceFeatureLayer.title, templateFeatureLayer, sourceServiceInfo, featuresExtent).then((createServiceResponse) => {

                // ADD SERVICE SUB-LAYERS //
                this.updateMessage(3, "Adding feature layer definition...");
                this._addServiceLayerDefinition(createServiceResponse.serviceurl, sourceServiceInfo.sourceLayerInfo).then(() => {

                  Layer.fromPortalItem({ portalItem: { id: createServiceResponse.itemId } }).then((targetFeatureLayer) => {
                    targetFeatureLayer.load().then(() => {

                      // TARGET FEATURE LAYER //
                      targetFeatureLayer.title = targetFeatureLayer.portalItem.title = sourceFeatureLayer.title;
                      targetFeatureLayer.displayField = sourceFeatureLayer.displayField;
                      targetFeatureLayer.popupTemplate = sourceFeatureLayer.popupTemplate;
                      targetFeatureLayer.renderer = sourceFeatureLayer.renderer;

                      // TARGET PORTAL ITEM //
                      targetFeatureLayer.portalItem.snippet = templateFeatureLayer.portalItem.snippet;
                      targetFeatureLayer.portalItem.description = templateFeatureLayer.portalItem.description;
                      targetFeatureLayer.portalItem.tags = templateFeatureLayer.portalItem.tags;
                      targetFeatureLayer.portalItem.licenseInfo = templateFeatureLayer.portalItem.licenseInfo;
                      targetFeatureLayer.portalItem.accessInformation = templateFeatureLayer.portalItem.accessInformation;

                      // EXTENT //
                      targetFeatureLayer.portalItem.extent = webMercatorUtils.webMercatorToGeographic(featuresExtent);


                      // INITIAL UPDATE FEATURE SERVICE SUBLAYER //
                      // - RENDERER AND LABELING ONLY //
                      this.updateMessage(4, "Updating new service definition...");
                      this._updateServiceLayerDefinition(targetFeatureLayer).then(() => {

                        // UPDATE ITEM //
                        this.updateMessage(5, "Updating new item details...");
                        this._updateFeatureLayerItem(targetFeatureLayer).then(() => {

                          // MOVE ITEM TO USER FOLDER //
                          this.updateMessage(6, "Moving new item to folder...");
                          this._moveItemToUserFolder(targetFeatureLayer, createParameters.destinationFolderId || "/").then(() => {

                            this.updateMessage(7, "Sharing new item to public...");
                            this._shareItemToPublic(targetFeatureLayer).then(() => {

                              // UPLOAD SOURCE FEATURES IN THE CURRENT VIEW //
                              this.updateMessage(8, "Uploading features to new feature service...");
                              this._uploadSourceFeatures(targetFeatureLayer, sourceFeatureLayer.source).then((addFeatureResult) => {

                                // UPLOAD IMAGE ATTACHMENT //
                                this.updateMessage(9, "Uploading attachments to new feature service...");
                                this._uploadImageAttachments(targetFeatureLayer, addFeatureResult, createParameters.attachmentInfos, createParameters.resizeOption).then(() => {

                                  // INFORM USER THAT ITEM HAS BEEN CREATED //
                                  this.updateMessage(-1, "New Hosted Feature Service and Feature Layer Item created successfully.");
                                  deferred.resolve({ itemId: createServiceResponse.itemId });

                                }).otherwise(onUploadError);
                              }).otherwise(onUploadError);
                            }).otherwise(onUploadError);
                          }).otherwise(onUploadError);
                        }).otherwise(onUploadError);
                      }).otherwise(onUploadError);
                    }).otherwise(onUploadError);
                  }).otherwise(onUploadError);
                }).otherwise(onUploadError);
              }).otherwise(onUploadError);
            }).otherwise(onUploadError);
          }).otherwise(onUploadError);
        }).otherwise(onUploadError);

      } else {
        onUploadError(new Error("NOT Signed In"));
      }

      return deferred.promise;
    },

    /**
     *
     * @param serviceUrl
     * @returns {string}
     */
    _generateAdminUrl: function (serviceUrl) {
      return serviceUrl.replace(/rest\/services/i, "rest/admin/services");
    },

    /**
     * http://resources.arcgis.com/en/help/arcgis-rest-api/index.html#/Check_Service_Name/02r300000076000000/
     *
     * @param newServiceName
     * @returns {*}
     */
    isServiceNameAvailable: function (newServiceName) {
      return esriRequest(`${this.portal.restUrl}/portals/${this.portal.id}/isServiceNameAvailable`, {
        query: {
          name: newServiceName.replace(/ /g, "_"),
          type: "Feature Service",
          f: "json"
        },
        method: "post"
      }).then((response) => {
        return response.data.available;
      });
    },

    /**
     *  http://resources.arcgis.com/en/help/arcgis-rest-api/index.html#/Map_Service/02r30000022w000000/
     *  http://resources.arcgis.com/en/help/arcgis-rest-api/index.html#/Feature_Service/02r300000231000000/
     *  http://resources.arcgis.com/en/help/arcgis-rest-api/index.html#/Feature_Layer/02r300000225000000/
     *
     * @param templateFeatureLayer
     * @returns {*}
     */
    _copyServiceSchema: function (templateFeatureLayer) {

      // TEMPLATE FEATURE SERVICE URL //
      //const templateMapOrFeatureServiceUrl = templateFeatureLayerUrl.replace(/\/(Feature|Map)Server\/\d*/gi, "/$1Server");
      const templateFeatureServiceUrl = templateFeatureLayer.url;
      const templateFeatureLayerUrl = `${templateFeatureLayer.url}/${templateFeatureLayer.layerId}`;

      // GET SERVICE DETAILS //
      return esriRequest(templateFeatureServiceUrl, { query: { f: "json" } }).then((serviceResponse) => {

        // SERVICE DETAILS //
        delete serviceResponse.data.layers;
        const featureServiceJson = { service: serviceResponse.data };

        // ONLY ADD THE SOURCE SUB-LAYER //
        // GET SUB-LAYER DETAILS //
        return esriRequest(templateFeatureLayerUrl, { query: { f: "json" } }).then((subLayerResponse) => {

          // LAYER INFO //
          const layerInfo = subLayerResponse.data;

          // NEW FIELDS //
          const newFields = layerInfo.fields.filter((field) => {
            const invalidFieldTypes = ["esriFieldTypeGeometry"];
            return ((invalidFieldTypes.indexOf(field.type) === -1) && (!field.name.startsWith("Shape_")));
          });
          // NEW INDEX //
          const newIndexes = layerInfo.indexes.filter((index) => {
            const invalidIndexFields = ["OBJECTID"];
            return ((invalidIndexFields.indexOf(index.fields) === -1) && (!index.fields.startsWith("Shape_")));
          });

          // SOURCE LAYER INFO //
          featureServiceJson.sourceLayerInfo = lang.mixin(layerInfo, {
            "adminLayerInfo": {
              "xssTrustedFields": "",
              "geometryField": { "name": "Shape" }
            },
            "capabilities": "Create,Delete,Query,Update,Editing,Extract",
            "fields": newFields,
            "indexes": newIndexes
          });

          return featureServiceJson;
        });
      });

    },

    /**
     * https://resources.arcgis.com/en/help/arcgis-rest-api/index.html#/Create_Service/02r30000027r000000/
     *
     * @param serviceName
     * @param templateFeatureLayer
     * @param sourceServiceInfo
     * @param initialExtent
     * @returns {*}
     */
    _createFeatureService: function (serviceName, templateFeatureLayer, sourceServiceInfo, initialExtent) {
      //console.info(JSON.stringify({
      //  templateFeatureLayer: templateFeatureLayer.portalItem.toJSON(),
      //  sourceServiceInfo: sourceServiceInfo
      //}));
      //"name": `${templateFeatureLayer.portalItem.title}_${(new Date()).valueOf()}`,

      // CREATE HOSTED SERVICE PARAMETERS //
      const createParameters = {
        "name": serviceName.replace(/ /g, "_"),
        "serviceDescription": templateFeatureLayer.portalItem.snippet,
        "initialExtent": JSON.stringify(initialExtent.toJSON()),
        "fullExtent": JSON.stringify(initialExtent.toJSON()),
        "supportedQueryFormats": "JSON,geoJSON",
        "capabilities": "Create,Delete,Query,Update,Editing,Extract,Sync",
        "maxRecordCount": 2500,
        "standardMaxRecordCount": 32000,
        "tileMaxRecordCount": 8000,
        "maxRecordCountFactor": 1,
        "copyrightText": templateFeatureLayer.portalItem.accessInformation,
        "defaultVisibility": true,
        "displayField": templateFeatureLayer.displayField,
        "minScale": 0,
        "maxScale": 0,
        "tables": []
      };

      // CREATE SERVICE //
      return esriRequest(`${this.portal.user.userContentUrl}/createService`, {
        query: {
          createParameters: JSON.stringify(createParameters),
          targetType: "featureService",
          f: "json"
        },
        method: "post"
      }).then((createServiceResponse) => {
        const notSecure = /http:/i;
        if(notSecure.test(createServiceResponse.data.serviceurl)) {
          createServiceResponse.data.serviceurl = createServiceResponse.data.serviceurl.replace(notSecure, "https:");
        }
        return createServiceResponse.data;
      });

    },

    /**
     * http://resources.arcgis.com/en/help/arcgis-rest-api/index.html#/Add_to_Definition_Feature_Service/02r300000230000000/
     *
     * @param serviceUrl
     * @param sourceLayerInfo
     * @returns {*}
     * @private
     */
    _addServiceLayerDefinition: function (serviceUrl, sourceLayerInfo) {
      const userCredentials = IdentityManager.findCredential(this.portal.url, this.portal.user.username);

      return esriRequest(this._generateAdminUrl(serviceUrl) + "/AddToDefinition", {
        query: {
          addToDefinition: JSON.stringify({ layers: [sourceLayerInfo] }),
          token: userCredentials.token,
          f: "json"
        },
        method: "post"
      });

    },

    /**
     * http://resources.arcgis.com/en/help/arcgis-rest-api/index.html#/Apply_Edits_Feature_Service_Layer/02r3000000r6000000/
     *
     * @param targetFeatureLayer
     * @param sourceFeatures
     * @returns {*}
     * @private
     */
    _uploadSourceFeatures: function (targetFeatureLayer, sourceFeatures) {

      const globalIDField = targetFeatureLayer.fields.find((field) => {
        return (field.type === "global-id");
      });
      const hasGlobalIDs = (globalIDField != null);

      // CREATE NEW EDITS INFOS //
      const addEditsInfos = sourceFeatures.reduce((infos, feature) => {
        // NEW FEATURE //
        const copyAttributes = lang.mixin({}, feature.attributes || {});
        if(targetFeatureLayer.objectIdField in copyAttributes) {
          delete copyAttributes[targetFeatureLayer.objectIdField];
        }
        if(hasGlobalIDs && (!(globalIDField.name in copyAttributes))) {
          copyAttributes[globalIDField.name] = this.generateGUID();
        }
        const newFeature = new Graphic({ geometry: feature.geometry, attributes: copyAttributes });
        infos.features.push(newFeature.toJSON());
        return infos;
      }, { features: [] });

      // SPLIT EDITS INTO GROUPS //
      const addEditsInfosSubsets = [];
      while (addEditsInfos.features.length > 0) {
        addEditsInfosSubsets.push({
          features: addEditsInfos.features.splice(0, +this.featureUploadCount)
        });
      }

      // APPLY EDITS //
      const applyEditsUrl = `${targetFeatureLayer.url}/${targetFeatureLayer.layerId}/applyEdits`;
      const applyEditsHandles = addEditsInfosSubsets.map((addEditsInfosSubset) => {

        return esriRequest(applyEditsUrl, {
          query: {
            useGlobalIds: hasGlobalIDs,
            adds: JSON.stringify(addEditsInfosSubset.features),
            f: "json"
          },
          method: "post"
        }).then((applyEditResponse) => {
          return applyEditResponse.data.addResults;
        });
      });

      // RESOLVE WHEN ALL APPLYEDITS ARE COMPLETE //
      return all(applyEditsHandles).then((allAddResults) => {
        return allAddResults.reduce((list, addResult) => {
          return list.concat(addResult);
        }, []);
      });

    },

    /**
     *
     * @param targetFeatureLayer
     * @param addFeatureResult
     * @param attachmentInfos
     * @param resizeOption
     * @returns {Promise}
     * @private
     */
    _uploadImageAttachments: function (targetFeatureLayer, addFeatureResult, attachmentInfos, resizeOption) {
      // DO WE HAVE ATTACHMENTS //
      if((attachmentInfos != null) && (Object.keys(attachmentInfos).length > 0)) {
        // ATTACHMENT HELPERS //
        const attachmentHelpers = this._createAttachmentHelpers(targetFeatureLayer, attachmentInfos);
        // UPLOAD IMAGE AND THUMBNAIL AS ATTACHMENTS FOR EACH FEATURE ADDED //
        const uploadHandles = addFeatureResult.reduce((infos, addResult) => {
          if(addResult.success) {

            const attachmentInfo = attachmentHelpers.getAttachment(addResult.globalId, resizeOption);
            if(attachmentInfo) {
              infos.push(attachmentHelpers.uploadAttachment(addResult.objectId, attachmentInfo.imageInfo.imageBlob, attachmentInfo.name).then((uploadResults) => {
                return uploadResults;
              }));
            }

            const attachmentInfoThumb = attachmentHelpers.getAttachment(addResult.globalId, "resize-thumbnail");
            if(attachmentInfoThumb) {
              infos.push(attachmentHelpers.uploadAttachment(addResult.objectId, attachmentInfoThumb.imageInfo.imageBlob, "thumbnail_" + attachmentInfoThumb.name).then((uploadResults) => {
                return uploadResults;
              }));
            }

          }
          return infos;
        }, []);
        return (uploadHandles.length > 0) ? promiseUtils.eachAlways(uploadHandles).then() : promiseUtils.resolve();
      } else {
        return promiseUtils.resolve();
      }
    },

    /**
     *  http://resources.arcgis.com/en/help/arcgis-rest-api/index.html#/Add_Attachment/02r3000000wt000000/
     *
     * @param targetFeatureLayer
     * @param attachmentInfos
     * @returns {function(*, *)}
     */
    _createAttachmentHelpers: function (targetFeatureLayer, attachmentInfos) {
      return {
        getAttachment: (parentGlobalId, resizeOption) => {
          const attachmentInfo = attachmentInfos[parentGlobalId];
          if(attachmentInfo) {
            //console.info("getAttachment: ", parentGlobalId, attachmentInfo, resizeOption);
            return {
              globalId: attachmentInfo.globalId,
              parentGlobalId: attachmentInfo.parentGlobalId,
              contentType: attachmentInfo.contentType,
              name: attachmentInfo.name,
              imageInfo: attachmentInfo.imageInfos[resizeOption]
            };
          } else {
            return null;
          }
        },
        uploadAttachment: (featureOID, imageBlob, filename) => {
          // FORM //
          const formNode = domConstruct.create("form", { "method": "post", "enctype": "multipart/form-data" });
          const formData = new FormData(formNode);
          formData.append("attachment", imageBlob, filename);

          // ADD ATTACHMENT //
          return esriRequest(`${targetFeatureLayer.url}/${targetFeatureLayer.layerId}/${featureOID}/addAttachment`, {
            query: { f: "json" },
            body: formData,
            method: "post",
            responseType: "json"
          }).then((response) => {
            return response.data.addAttachmentResult;
          }).otherwise((error) => {
            return { success: false, error: error };
          });
        }
      };
    },

    /**
     * http://resources.arcgis.com/en/help/arcgis-rest-api/index.html#/Update_Definition_Feature_Layer/02r30000022p000000/
     *
     * @param targetFeatureLayer
     */
    _updateServiceLayerDefinition: function (targetFeatureLayer) {

      const updateDefinitionUrl = `${targetFeatureLayer.url}/${targetFeatureLayer.layerId}/updateDefinition`;
      const updateDefinitionAdminUrl = this._generateAdminUrl(updateDefinitionUrl);
      const userCredentials = IdentityManager.findCredential(this.portal.url, this.portal.user.username);

      return esriRequest(updateDefinitionAdminUrl, {
        query: {
          updateDefinition: JSON.stringify({
            "defaultVisibility": true,
            "displayField": targetFeatureLayer.displayField,
            "description": targetFeatureLayer.portalItem.description,
            "copywriteText": targetFeatureLayer.portalItem.accessInformation,
            "minScale": 0,
            "maxScale": 0,
            "drawingInfo": {
              "transparency": 0,
              "labelingInfo": null,
              "renderer": targetFeatureLayer.renderer.toJSON()
            }
          }),
          token: userCredentials.token,
          f: "json"
        },
        method: "post"
      });

    },

    /**
     *  http://resources.arcgis.com/en/help/arcgis-rest-api/index.html#/Update_Item/02r30000009s000000/
     *
     * @param templatePortalItem
     * @param itemId
     * @param targetFeatureLayer
     * @param extent
     * @returns {*}
     */
    /*_updateLayerItem: function (templatePortalItem, itemId, targetFeatureLayer, extent) {

     const updateUrl = `${this.portal.user.userContentUrl}/items/${itemId}/update`;

     const popupTemplateJSON = targetFeatureLayer.popupTemplate ? targetFeatureLayer.popupTemplate.toJSON() : null;

     return esriRequest(updateUrl, {
     query: {
     title: targetFeatureLayer.title,
     snippet: templatePortalItem.snippet,
     description: templatePortalItem.description,
     extent: lang.replace("{xmin},{ymin},{xmax},{ymax}", webMercatorUtils.webMercatorToGeographic(extent)),
     licenseInfo: templatePortalItem.licenseInfo,
     accessInformation: templatePortalItem.accessInformation,
     tags: templatePortalItem.tags.join(","),
     text: JSON.stringify({ "layers": [{ "id": 0, "layerDefinition": { "defaultVisibility": true }, "showLabels": false, "timeInfo": {}, "popupInfo": popupTemplateJSON }] }),
     f: "json"
     },
     method: "post"
     });

     },*/

    /**
     *
     * @param targetFeatureLayer
     * @returns {*}
     * @private
     */
    _updateFeatureLayerItem: function (targetFeatureLayer) {
      const popupTemplateJSON = targetFeatureLayer.popupTemplate ? targetFeatureLayer.popupTemplate.toJSON() : null;
      return targetFeatureLayer.portalItem.update({
        data: JSON.stringify({ "layers": [{ "id": 0, "layerDefinition": { "defaultVisibility": true }, "showLabels": false, "timeInfo": {}, "popupInfo": popupTemplateJSON }] })
      });
      //return targetFeatureLayer.portalItem.update();
    },

    /**
     * http://resources.arcgis.com/en/help/arcgis-rest-api/index.html#/Move_Item/02r300000078000000/
     *
     * @param targetFeatureLayer
     * @param folderId
     * @returns {*}
     * @private
     */
    _moveItemToUserFolder: function (targetFeatureLayer, folderId) {
      // NEW SERVICE IS CREATED IN ROOT FOLDER SO WE ONLY NEED //
      // TO MOVE IT IF USER HAS SELECTED A DIFFERENT FOLDER //
      if(folderId !== "/") {
        return esriRequest(`${targetFeatureLayer.portalItem.userItemUrl}/move`, {
          query: {
            folder: folderId,
            f: "json"
          },
          method: "post"
        });
      } else {
        return promiseUtils.resolve();
      }
    },


    /**
     *
     * @param targetFeatureLayer
     * @returns {*}
     * @private
     */
    _shareItemToPublic: function (targetFeatureLayer) {
      return esriRequest(`${targetFeatureLayer.portalItem.userItemUrl}/share`, {
        query: {
          everyone: true,
          org: true,
          f: "json"
        },
        method: "post"
      });
    },

    /**
     * Modified from https://stackoverflow.com/questions/105034/create-guid-uuid-in-javascript
     *    - uuidv4
     *
     * @returns {string}
     * @private
     */
    generateGUID: function () {
      return '{xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx}'.replace(/[xy]/g, function (c) {
        const r = Math.random() * 16 | 0;
        const v = (c == 'x') ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
    }

  });

  HostedFeatureServiceUtils.version = "0.0.5";

  return HostedFeatureServiceUtils;
});