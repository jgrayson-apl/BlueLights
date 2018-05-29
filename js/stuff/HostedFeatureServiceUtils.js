/**
 *
 * HostedFeatureServiceUtils
 *  - Utility to help create a hosted Feature Layer
 *
 * Author:   John Grayson - Applications Prototype Lab - Esri
 * Created:  09/27/2017 - 0.0.2 -
 * Modified: 10/10/2017 - 0.0.3 - updated to JS API 4.5 and using esri.core.Accessor
 * Modified: 10/18/2017 - 0.0.4 - updated to include attachments
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
     * @param templateFeatureLayerItemId
     * @param sourceFeatureLayer
     * @param destinationFolderId
     * @param attachmentInfos
     * @param resizeOption
     * @returns {Promise}
     */
    createHostedFeatureLayer: function (templateFeatureLayerItemId, sourceFeatureLayer, destinationFolderId, attachmentInfos, resizeOption) {
      const deferred = new Deferred();

      if(this.portal && this.portal.user) {

        Layer.fromPortalItem({ portalItem: { id: templateFeatureLayerItemId } }).then((templateFeatureLayer) => {
          templateFeatureLayer.load().then(() => {

            // EXTENT OF ALL FEATURES //
            const featuresExtentUnion = geometryEngine.union(sourceFeatureLayer.source.toArray().map((sourceFeature) => {
              return sourceFeature.geometry;
            }));
            const featuresExtent = featuresExtentUnion.extent;

            // UPLOAD ERROR //
            const onUploadError = (error) => {
              if(!error) {
                error = new Error("Unknown error...");
              }
              this.updateMessage(-1, JSON.stringify(error), true);
              deferred.reject(error);
            };

            // COPY SOURCE SERVICE AND LAYER //
            this.updateMessage(1, "Getting source layer details...");
            this._copyServiceSchema(templateFeatureLayer).then((sourceServiceInfo) => {

              // CREATE NEW HOSTED FEATURE SERVICE //
              this.updateMessage(2, "Creating new hosted service...");
              this._createFeatureService(templateFeatureLayer, sourceServiceInfo, featuresExtent).then((createServiceResponse) => {

                // ADD SERVICE SUB-LAYERS //
                this.updateMessage(3, "Adding feature layer definition...");
                this._addServiceSubLayers(createServiceResponse.serviceurl, sourceServiceInfo.sourceLayerInfo).then((addLayersResponse) => {

                  Layer.fromPortalItem({ portalItem: { id: createServiceResponse.itemId } }).then((targetFeatureLayer) => {
                    targetFeatureLayer.load().then(() => {
                      //console.info(targetFeatureLayer.title, targetFeatureLayer.type, targetFeatureLayer);

                      targetFeatureLayer.title = sourceFeatureLayer.title;
                      targetFeatureLayer.popupTemplate = sourceFeatureLayer.popupTemplate;
                      targetFeatureLayer.renderer = sourceFeatureLayer.renderer;

                      // INITIAL UPDATE FEATURE SERVICE SUBLAYER //
                      // - RENDERER AND LABELING ONLY //
                      this.updateMessage(4, "Updating new service definition...");
                      this._updateLayerDefinition(targetFeatureLayer).then(() => {

                        // UPDATE ITEM //
                        this.updateMessage(5, "Updating new item details...");
                        this._updateLayerItem(templateFeatureLayer.portalItem, createServiceResponse.itemId, targetFeatureLayer, featuresExtent).then(() => {

                          // MOVE ITEM TO USER FOLDER //
                          this.updateMessage(6, "Moving new item to folder...");
                          this._moveItemToUserFolder(createServiceResponse.itemId, destinationFolderId).then(() => {

                            // UPLOAD SOURCE FEATURES IN THE CURRENT VIEW //
                            this.updateMessage(7, "Uploading features to new feature service...");
                            this._uploadSourceFeatures(targetFeatureLayer, sourceFeatureLayer.source).then((addFeatureResult) => {

                              // UPLOAD IMAGE ATTACHMENT //
                              this.updateMessage(8, "Uploading attachments to new feature service...");
                              this._uploadImageAttachments(targetFeatureLayer, addFeatureResult, attachmentInfos, resizeOption).then(() => {

                                // INFORM USER THAT ITEM HAS BEEN CREATED //
                                this.updateMessage(-1, "New Hosted Feature Service and Feature Layer Item created successfully.");
                                deferred.resolve({ itemId: createServiceResponse.itemId });

                              }, onUploadError);
                            }, onUploadError);
                          }, onUploadError);
                        }, onUploadError);
                      }, onUploadError);
                    }, onUploadError);
                  }, onUploadError);
                }, onUploadError);
              }, onUploadError);
            }, onUploadError);
          });
        });

      } else {
        console.warn("NOT Signed In");
        deferred.reject(new Error("NOT Signed In"));
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
      const deferred = new Deferred();

      esriRequest(`${this.portal.portalUrl}/portals/${this.portal.id}/isServiceNameAvailable`, {
        query: {
          name: newServiceName,
          type: "Feature Service",
          f: "json"
        },
        method: "post"
      }).then((response) => {
        deferred.resolve(response.available);
      }, deferred.reject);

      return deferred.promise;
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
      const deferred = new Deferred();

      // TEMPLATE FEATURE SERVICE URL //
      //const templateMapOrFeatureServiceUrl = templateFeatureLayerUrl.replace(/\/(Feature|Map)Server\/\d*/gi, "/$1Server");
      const templateFeatureServiceUrl = templateFeatureLayer.url;
      const templateFeatureLayerUrl = `${templateFeatureLayer.url}/${templateFeatureLayer.layerId}`;

      // GET SERVICE DETAILS //
      esriRequest(templateFeatureServiceUrl, { query: { f: "json" } }).then((serviceResponse) => {

        // SERVICE DETAILS //
        delete serviceResponse.data.layers;
        const featureServiceJson = { service: serviceResponse.data };

        // ONLY ADD THE SOURCE SUB-LAYER //
        // GET SUB-LAYER DETAILS //
        esriRequest(templateFeatureLayerUrl, { query: { f: "json" } }).then((subLayerResponse) => {

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

          deferred.resolve(featureServiceJson);
        }, console.warn);

      }, deferred.reject);

      return deferred.promise;
    },

    /**
     * https://resources.arcgis.com/en/help/arcgis-rest-api/index.html#/Create_Service/02r30000027r000000/
     *
     * @param templateFeatureLayer
     * @param sourceServiceInfo
     * @param initialExtent
     * @returns {*}
     */
    _createFeatureService: function (templateFeatureLayer, sourceServiceInfo, initialExtent) {
      const deferred = new Deferred();

      //console.info("_createFeatureService: ", templateFeatureLayer, sourceServiceInfo);

      // CREATE HOSTED SERVICE PARAMETERS //
      const createParameters = {
        "name": `${templateFeatureLayer.portalItem.title}_${(new Date()).valueOf()}`,
        "description": templateFeatureLayer.portalItem.snippet,
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
        "displayField": "Name",
        "minScale": 0,
        "maxScale": 0,
        "tables": []
      };

      // CREATE SERVICE //
      esriRequest(`${this.portal.user.userContentUrl}/createService`, {
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
        deferred.resolve(createServiceResponse.data);
      }, deferred.reject);

      return deferred.promise;
    },

    /**
     * http://resources.arcgis.com/en/help/arcgis-rest-api/index.html#/Add_to_Definition_Feature_Service/02r300000230000000/
     *
     * @param serviceUrl
     * @param sourceLayerInfo
     * @returns {*}
     * @private
     */
    _addServiceSubLayers: function (serviceUrl, sourceLayerInfo) {
      const deferred = new Deferred();

      const userCredentials = IdentityManager.findCredential(this.portal.url, this.portal.user.username);

      esriRequest(this._generateAdminUrl(serviceUrl) + "/AddToDefinition", {
        query: {
          addToDefinition: JSON.stringify({ layers: [sourceLayerInfo] }),
          token: userCredentials.token,
          f: "json"
        },
        method: "post"
      }).then((addToDefinitionResponse) => {
        deferred.resolve(addToDefinitionResponse.data)
      }, deferred.reject);

      return deferred.promise;
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
      const deferred = new Deferred();

      // CREATE NEW EDITS INFOS //
      const addEditsInfos = sourceFeatures.reduce((infos, feature) => {
        // NEW FEATURE //
        const copyAttributes = lang.mixin({}, feature.attributes || {});
        if(targetFeatureLayer.objectIdField in copyAttributes) {
          delete copyAttributes[targetFeatureLayer.objectIdField];
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
      const applyEditsHandles = addEditsInfosSubsets.map((addEditsInfosSubset, addEditsInfosSubsetIndex) => {

        return esriRequest(applyEditsUrl, {
          query: {
            adds: JSON.stringify(addEditsInfosSubset.features),
            f: "json"
          },
          method: "post"
        }).then((applyEditResponse) => {
          return applyEditResponse.data.addResults;
        });
      });

      // RESOLVE WHEN ALL APPLYEDITS ARE COMPLETE //
      all(applyEditsHandles).then((allAddResults) => {
        const addResults = allAddResults.reduce((list, addResult) => {
          return list.concat(addResult);
        }, []);
        deferred.resolve(addResults);
      }, deferred.reject);

      return deferred.promise;
    },


    /**
     *
     * @param targetFeatureLayer
     * @param sourceFeatures
     * @returns {*}
     * @private
     */
    _uploadSourceFeaturesAndAttachments: function (targetFeatureLayer, sourceFeatures) {
      const deferred = new Deferred();

      // CREATE NEW EDITS INFOS //
      const addEditsInfos = sourceFeatures.reduce((infos, feature) => {
        // NEW FEATURE //
        const copyAttributes = lang.mixin({}, feature.attributes || {});
        if(targetFeatureLayer.objectIdField in copyAttributes) {
          delete copyAttributes[targetFeatureLayer.objectIdField];
        }
        const newFeature = new Graphic({ geometry: feature.geometry, attributes: copyAttributes });
        infos.features.push(newFeature.toJSON());
        return infos;
      }, { features: [] });

      // SPLIT SOURCE FEATURES INTO GROUPS //
      /* const featureUploadCount = 300;
       const featuresSubsets = [];
       const attachmentsSubsets = [];
       while (newFeatures.length > 0) {
       const featuresSubset = newFeatures.splice(0, featureUploadCount);
       featuresSubsets.push(featuresSubset);
       const attachmentSubset = newAttachments.splice(0, featureUploadCount);
       attachmentsSubsets.push(attachmentSubset);
       }*/

      // SPLIT EDITS INTO GROUPS //
      const addEditsInfosSubsets = [];
      while (addEditsInfos.features.length > 0) {
        addEditsInfosSubsets.push({
          features: addEditsInfos.features.splice(0, +this.featureUploadCount),
          attachmentInfos: addEditsInfos.attachmentInfos.splice(0, +this.featureUploadCount)
        });
      }

      // APPLY EDITS //
      const applyEditsUrl = `${targetFeatureLayer.url}/${targetFeatureLayer.layerId}/applyEdits`;
      const applyEditsHandles = addEditsInfosSubsets.map((addEditsInfosSubset, addEditsInfosSubsetIndex) => {

        return esriRequest(applyEditsUrl, {
          query: {
            useGlobalIds: true,
            adds: JSON.stringify(addEditsInfosSubset.features),
            attachments: JSON.stringify({ adds: addEditsInfosSubset.attachmentInfos }),
            f: "json"
          },
          method: "post"
        }).then((applyEditResponse) => {
          return applyEditResponse.data.addResults;
        });
      });

      // RESOLVE WHEN ALL APPLYEDITS ARE COMPLETE //
      all(applyEditsHandles).then((allAddResults) => {
        const addResults = allAddResults.reduce((list, addResult) => {
          return list.concat(addResult);
        }, []);
        deferred.resolve(addResults);
      }, deferred.reject);

      return deferred.promise;
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
        // UPLOAD IMAGES AS ATTACHMENT FOR EACH FEATURE ADDED //
        const uploadHandles = addFeatureResult.reduce((infos, addResult) => {
          if(addResult.success) {

            const attachmentInfo = attachmentHelpers.getAttachment(addResult.globalId, resizeOption);
            infos.push(attachmentHelpers.uploadAttachment(addResult.objectId, attachmentInfo.imageInfo.imageBlob, attachmentInfo.name).then((uploadResults) => {
              return uploadResults;
            }));

            const attachmentInfoThumb = attachmentHelpers.getAttachment(addResult.globalId, "resize-thumbnail");
            infos.push(attachmentHelpers.uploadAttachment(addResult.objectId, attachmentInfoThumb.imageInfo.imageBlob, "thumbnail_" + attachmentInfoThumb.name).then((uploadResults) => {
              return uploadResults;
            }));
          }
          return infos;
        }, []);
        return promiseUtils.eachAlways(uploadHandles).then();
      } else {
        return promiseUtils.resolve();
      }
    },

    /**
     *
     * @param targetFeatureLayer
     * @param attachmentInfos
     * @returns {function(*, *)}
     * @private
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
            return response.data.addAttachmentResponse;
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
    _updateLayerDefinition: function (targetFeatureLayer) {

      const targetFeatureLayerUrl = `${targetFeatureLayer.url}/${targetFeatureLayer.layerId}`;
      const updateDefinitionUrl = this._generateAdminUrl(targetFeatureLayerUrl) + "/updateDefinition";
      const userCredentials = IdentityManager.findCredential(this.portal.url, this.portal.user.username);

      return esriRequest(updateDefinitionUrl, {
        query: {
          updateDefinition: JSON.stringify({
            "drawingInfo": {
              "transparency": 0,
              "labelingInfo": [],
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
    _updateLayerItem: function (templatePortalItem, itemId, targetFeatureLayer, extent) {

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

    },

    /**
     * http://resources.arcgis.com/en/help/arcgis-rest-api/index.html#/Move_Item/02r300000078000000/
     *
     * @param itemId
     * @param folderId
     * @returns {*}
     * @private
     */
    _moveItemToUserFolder: function (itemId, folderId) {
      const deferred = new Deferred();

      // NEW SERVICE IS CREATED IN ROOT FOLDER SO WE ONLY NEED //
      // TO MOVE IT IF USER HAS SELECTED A DIFFERENT FOLDER //
      if(folderId !== "/") {
        const moveItemUrl = `${this.portal.user.userContentUrl}/items/${itemId}/move`;
        return esriRequest(moveItemUrl, {
          query: {
            folder: folderId,
            f: "json"
          },
          method: "post"
        }).then(deferred.resolve, deferred.reject);

      } else {
        deferred.resolve();
      }
      return deferred.promise;
    }

  });

  HostedFeatureServiceUtils.version = "0.0.4";

  return HostedFeatureServiceUtils;
});