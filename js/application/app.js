/*
 | Copyright 2016 Esri
 |
 | Licensed under the Apache License, Version 2.0 (the "License");
 | you may not use this file except in compliance with the License.
 | You may obtain a copy of the License at
 |
 |    http://www.apache.org/licenses/LICENSE-2.0
 |
 | Unless required by applicable law or agreed to in writing, software
 | distributed under the License is distributed on an "AS IS" BASIS,
 | WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 | See the License for the specific language governing permissions and
 | limitations under the License.
 */
define([
  "calcite",
  "boilerplate/ItemHelper",
  "boilerplate/UrlParamHelper",
  "dojo/i18n!./nls/resources",
  "dojo/_base/declare",
  "dojo/_base/lang",
  "dojo/_base/array",
  "dojo/_base/Color",
  "dojo/colors",
  "dojo/number",
  "dojo/query",
  "dojo/on",
  "dojo/mouse",
  "dojo/Deferred",
  "dojo/dom",
  "dojo/dom-attr",
  "dojo/dom-class",
  "dojo/dom-style",
  "dojo/dom-geometry",
  "dojo/dom-construct",
  "dojo/cookie",
  "esri/identity/IdentityManager",
  "esri/core/Evented",
  "esri/core/watchUtils",
  "esri/core/promiseUtils",
  "esri/portal/Portal",
  "esri/Map",
  "esri/Graphic",
  "esri/views/MapView",
  "esri/layers/Layer",
  "esri/layers/GraphicsLayer",
  "esri/layers/FeatureLayer",
  "esri/renderers/SimpleRenderer",
  "esri/renderers/UniqueValueRenderer",
  "esri/symbols/SimpleMarkerSymbol",
  "esri/symbols/SimpleLineSymbol",
  "esri/symbols/SimpleFillSymbol",
  "esri/symbols/PictureMarkerSymbol",
  "esri/symbols/PictureFillSymbol",
  "esri/geometry/geometryEngine",
  "esri/geometry/geometryEngineAsync",
  "esri/geometry/Point",
  "esri/geometry/Multipoint",
  "esri/geometry/Polyline",
  "esri/geometry/Polygon",
  "esri/geometry/Circle",
  "esri/widgets/Sketch/SketchViewModel",
  "esri/tasks/Geoprocessor",
  "esri/tasks/support/FeatureSet",
  "esri/widgets/Home",
  "esri/widgets/Print",
  "esri/widgets/ScaleBar",
  "esri/widgets/BasemapGallery",
  "esri/widgets/Expand",
  "./HostedFeatureServiceUtils",
  "./ProgressUI"
], function (calcite, ItemHelper, UrlParamHelper, i18n, declare, lang, array, Color, colors, number, query, on, mouse, Deferred,
             dom, domAttr, domClass, domStyle, domGeom, domConstruct, cookie,
             IdentityManager, Evented, watchUtils, promiseUtils, Portal, EsriMap, Graphic, MapView, Layer, GraphicsLayer, FeatureLayer,
             SimpleRenderer, UniqueValueRenderer, SimpleMarkerSymbol, SimpleLineSymbol, SimpleFillSymbol,
             PictureMarkerSymbol, PictureFillSymbol, geometryEngine, geometryEngineAsync, Point, Multipoint, Polyline, Polygon, Circle,
             SketchViewModel,
             Geoprocessor, FeatureSet, Home, Print, ScaleBar, BasemapGallery, Expand,
             HostedFeatureServiceUtils, ProgressUI) {

  return declare([Evented], {

    config: null,
    direction: null,

    ANALYSIS_RESOLUTION: {
      FAST: 60,
      NORMAL: 360,
      FINEST: 720
    },

    /**
     *
     */
    constructor: function () {
      calcite.init();
    },

    /**
     *
     * @param boilerplateResponse
     */
    init: function (boilerplateResponse) {
      if(boilerplateResponse) {
        this.direction = boilerplateResponse.direction;
        this.config = boilerplateResponse.config;
        this.settings = boilerplateResponse.settings;
        const boilerplateResults = boilerplateResponse.results;
        const webMapItem = boilerplateResults.webMapItem;
        const webSceneItem = boilerplateResults.webSceneItem;
        const groupData = boilerplateResults.group;

        document.documentElement.lang = boilerplateResponse.locale;

        this.urlParamHelper = new UrlParamHelper();
        this.itemHelper = new ItemHelper();

        this._setDirection();

        if(webMapItem) {
          this._createWebMap(webMapItem);
        } else if(webSceneItem) {
          this._createWebScene(webSceneItem);
        } else {
          this.reportError(new Error("app:: Could not load an item to display"));
        }
      }
      else {
        this.reportError(new Error("app:: Boilerplate is not defined"));
      }
    },

    /**
     *
     * @param error
     * @returns {*}
     */
    reportError: function (error) {
      // remove loading class from body
      //domClass.remove(document.body, CSS.loading);
      //domClass.add(document.body, CSS.error);
      // an error occurred - notify the user. In this example we pull the string from the
      // resource.js file located in the nls folder because we've set the application up
      // for localization. If you don't need to support multiple languages you can hardcode the
      // strings here and comment out the call in index.html to get the localization strings.
      // set message
      let node = dom.byId("loading_message");
      if(node) {
        //node.innerHTML = "<h1><span class=\"" + CSS.errorIcon + "\"></span> " + i18n.error + "</h1><p>" + error.message + "</p>";
        node.innerHTML = "<h1><span></span>" + i18n.error + "</h1><p>" + error.message + "</p>";
      }
      return error;
    },

    /**
     *
     * @private
     */
    _setDirection: function () {
      let direction = this.direction;
      let dirNode = document.getElementsByTagName("html")[0];
      domAttr.set(dirNode, "dir", direction);
    },

    /**
     *
     * @param webMapItem
     * @private
     */
    _createWebMap: function (webMapItem) {
      this.itemHelper.createWebMap(webMapItem).then(function (map) {

        let viewProperties = {
          map: map,
          container: this.settings.webmap.containerId
        };

        if(!this.config.title && map.portalItem && map.portalItem.title) {
          this.config.title = map.portalItem.title;
        }

        lang.mixin(viewProperties, this.urlParamHelper.getViewProperties(this.config));
        require(["esri/views/MapView"], function (MapView) {

          let view = new MapView(viewProperties);
          view.then(function (response) {
            this.urlParamHelper.addToView(view, this.config);
            this._ready(view);
          }.bind(this), this.reportError);

        }.bind(this));
      }.bind(this), this.reportError);
    },

    /**
     *
     * @param webSceneItem
     * @private
     */
    _createWebScene: function (webSceneItem) {
      this.itemHelper.createWebScene(webSceneItem).then(function (map) {

        let viewProperties = {
          map: map,
          container: this.settings.webscene.containerId
        };

        if(!this.config.title && map.portalItem && map.portalItem.title) {
          this.config.title = map.portalItem.title;
        }

        lang.mixin(viewProperties, this.urlParamHelper.getViewProperties(this.config));
        require(["esri/views/SceneView"], function (SceneView) {

          let view = new SceneView(viewProperties);
          view.then(function (response) {
            this.urlParamHelper.addToView(view, this.config);
            this._ready(view);
          }.bind(this), this.reportError);
        }.bind(this));
      }.bind(this), this.reportError);
    },


    /**
     * USER SIGN IN
     */
    initializeUserSignIn: function (view) {

      // TOGGLE SIGN IN/OUT //
      let signInNode = dom.byId("sign-in-node");
      let signOutNode = dom.byId("sign-out-node");
      let userNode = dom.byId("user-node");

      // SIGN IN //
      let userSignIn = () => {
        this.portal = new Portal({ authMode: "immediate" });
        return this.portal.load().then(() => {
          //console.info(this.portal, this.portal.user);

          dom.byId("user-firstname-node").innerHTML = this.portal.user.fullName.split(" ")[0];
          dom.byId("user-fullname-node").innerHTML = this.portal.user.fullName;
          dom.byId("signed-in-username-node").value = this.portal.user.username;
          dom.byId("username-node").innerHTML = this.portal.user.username;
          dom.byId("user-thumb-node").src = this.portal.user.thumbnailUrl;

          domClass.add(signInNode, "hide");
          domClass.remove(userNode, "hide");

          domClass.remove(dom.byId("signed-in-username-node-message"), "is-active");
          domClass.remove(dom.byId("signed-in-username-node"), "input-error");
          domClass.add(dom.byId("signed-in-username-node"), "input-success");
          //this.toggleSaveBtn();

          // MAP DETAILS //
          this.displayMapDetails(view, this.portal);

          // USER FOLDERS //
          this.initializeUserFolders();

        }).otherwise(console.warn);
      };

      // SIGN OUT //
      let userSignOut = () => {
        IdentityManager.destroyCredentials();
        this.portal = new Portal({});
        this.portal.load().then(() => {

          this.portal.user = null;
          domClass.remove(signInNode, "hide");
          domClass.add(userNode, "hide");

          dom.byId("signed-in-username-node").value = null;
          domClass.add(dom.byId("signed-in-username-node-message"), "is-active");
          domClass.add(dom.byId("signed-in-username-node"), "input-error");
          domClass.remove(dom.byId("signed-in-username-node"), "input-success");
          //this.toggleSaveBtn();

          // MAP DETAILS //
          this.displayMapDetails(view);
        }).otherwise(console.warn);
      };


      // CALCITE CLICK EVENT //
      on(signInNode, "click", userSignIn);
      on(signOutNode, "click", userSignOut);

      // PORTAL //
      this.portal = new Portal({});
      return this.portal.load().then(() => {
        // CHECK THE SIGN IN STATUS WHEN APP LOADS //
        return IdentityManager.checkSignInStatus(this.portal.url).then(userSignIn);
      }).otherwise(console.warn);

    },

    /**
     * DISPLAY MAP DETAILS
     *
     * @param view
     * @param portal
     */
    displayMapDetails: function (view, portal) {

      const item = view.map.portalItem;
      const itemLastModifiedDate = (new Date(item.modified)).toLocaleString();

      dom.byId("current-map-card-thumb").src = item.thumbnailUrl;
      dom.byId("current-map-card-thumb").alt = item.title;
      dom.byId("current-map-card-caption").innerHTML = lang.replace("A map by {owner}", item);
      dom.byId("current-map-card-caption").title = "Last modified on " + itemLastModifiedDate;
      dom.byId("current-map-card-title").innerHTML = item.title;
      dom.byId("current-map-card-title").href = lang.replace("//{urlKey}.{customBaseUrl}/home/item.html?id={id}", {
        urlKey: portal ? portal.urlKey : "www",
        customBaseUrl: portal ? portal.customBaseUrl : "arcgis.com",
        id: item.id
      });
      dom.byId("current-map-card-description").innerHTML = item.description;

    },

    /**
     *
     * @private
     */
    _ready: function (view) {

      // TITLE //
      document.title = dom.byId("app-title-node").innerHTML = this.config.title;

      // USER SIGN IN //
      this.initializeUserSignIn(view).then(() => {

        // MAP DETAILS //
        this.displayMapDetails(view);

        // WHEN ALL LAYERS LOADED //
        this.whenLayersLoaded(view.map.allLayers).then(() => {

          // BLUE LIGHTS ANALYSIS //
          this.initializeBlueLightsAnalysis(view);

        }, console.warn);

      });

    },

    /**
     *
     * @param layers
     * @returns {Promise.<Layer>}
     */
    whenLayersLoaded: function (layers) {
      const layerLoadedHandles = layers.map((layer) => {
        if(layer.loaded) {
          return promiseUtils.resolve(layer);
        } else {
          return watchUtils.whenTrueOnce(layer, "loaded", () => {
            return layer;
          });
        }
      });
      return promiseUtils.eachAlways(layerLoadedHandles).then((layerLoadedResults) => {
        return layerLoadedResults.map((layerLoadedResult) => {
          return layerLoadedResult.value;
        });
      });
    },

    /**
     *
     * @param view
     */
    initializeViewUpdating: function (view) {

      const loaderNode = domConstruct.create("div", { className: "loader padding-leader-0 padding-trailer-0" });
      domConstruct.create("div", { className: "loader-bars" }, loaderNode);
      domConstruct.create("div", { className: "loader-text text-white font-size--3", innerHTML: "Updating..." }, loaderNode);
      view.ui.add(loaderNode, "bottom-right");
      watchUtils.init(view, "updating", (updating) => {
        domClass.toggle(loaderNode, "is-active", updating);
      });

    },

    /**
     *
     * @param view
     */
    initializeBlueLightsAnalysis: function (view) {

      // CLEAR UI FROM SOURCE VIEW //
      view.ui.components = [];
      view.constraints.rotationEnabled = false;


      // ANALYSIS VIEW //
      const analysisView = new MapView({
        container: "view-node",
        map: new EsriMap({ basemap: "hybrid" }),
        constraints: { rotationEnabled: false },
        extent: view.extent.clone()
      });
      return analysisView.then(() => {
        //this.initializeViewUpdating(analysisView);

        // PANE TOGGLE //
        const paneToggleBtn = domConstruct.create("div", { className: "panel-toggle icon-ui-left-triangle-arrow icon-ui-flush font-size-1", title: "Toggle Left Panel" }, analysisView.root);
        on(paneToggleBtn, "click", () => {
          domClass.toggle(paneToggleBtn, "icon-ui-left-triangle-arrow icon-ui-right-triangle-arrow");
          query("#left-pane").toggleClass("hide");
          query("#center-pane").toggleClass("column-18 column-24");
        });

        // SYNC EXTENTS //
        /*const syncExtents = (extent) => {
          analysisView.extent = view.extent = extent.clone();
        };
        analysisView.watch("extent", syncExtents);
        view.watch("extent", syncExtents);*/

        this.progressUI = new ProgressUI({
          view: analysisView,
          visible: false
        });

        // ADD SOURCE VIEW TO ANALYSIS VIEW //
        analysisView.ui.add(view.container, "top-right");

        // SCALEBAR //
        const scaleBar = new ScaleBar({ view: analysisView, unit: "dual" });
        analysisView.ui.add(scaleBar, { position: "bottom-left" });

        // BASEMAP OPACITY //
        const adjustDefaultBasemap = (opacity) => {
          const allBasemapLayers = analysisView.map.basemap.baseLayers.concat(analysisView.map.basemap.referenceLayers);
          allBasemapLayers.forEach((basemapLayer) => {
            basemapLayer.opacity = opacity
          });
        };

        // DAY/NIGHT NODE //
        const dayNightNode = domConstruct.create("div", { className: "daynight-node esri-widget" });
        analysisView.ui.add(dayNightNode, { position: "top-left", index: 0 });
        const basemapSlider = domConstruct.create("input", {
          type: "range",
          min: 0.0,
          max: 1.0,
          step: 0.5,
          value: 0.0
        }, dayNightNode);
        on(basemapSlider, "input", () => {
          adjustDefaultBasemap(1.0 - basemapSlider.value);
        });
        domConstruct.create("div", { className: "text-center", innerHTML: "day&nbsp;&nbsp;&nbsp;night" }, dayNightNode);

        // BASEMAP GALLERY //
        const basemapGallery = new BasemapGallery({
          view: analysisView,
          container: domConstruct.create("div")
        });
        // EXPAND BASEMAP GALLERY //
        const basemapGalleryExpand = new Expand({
          view: analysisView,
          content: basemapGallery.domNode,
          expandIconClass: "esri-icon-basemap",
          expandTooltip: "Basemap"
        }, domConstruct.create("div"));
        analysisView.ui.add(basemapGalleryExpand, { position: "top-left", index: 1 });

        // HOME //
        const homeWidget = new Home({ view: analysisView });
        analysisView.ui.add(homeWidget, { position: "top-left", index: 2 });


        // PRINT //
        const printServiceUrl = this.config.helperServices.printTask.url;
        if((analysisView.type === "2d") && (printServiceUrl && (printServiceUrl.length > 0))) {
          const print = new Print({
            view: analysisView,
            printServiceUrl: printServiceUrl
          }, "print-node");
          this.setPrintTitle = (title) => {
            const printTitleInput = query(".esri-print__input-text")[0];
            printTitleInput.value = title;
            printTitleInput.dispatchEvent(new Event("input"));
          };
          this.setPrintTitle(this.config.title);
        } else {
          domClass.add("print-action-node", "hide");
        }

        // FIND OPTIMAL //
        //this.initFindOptimal(analysisView);

        // OBSTRUCTIONS LAYER //
        const obstructionsLayer = this.initializeObstructionSources(analysisView, view.map);

        // LOCATIONS LAYER //
        const locationsLayer = this.initializeLocationsLayers(analysisView, view.map);

        // VISIBILITY LAYER //
        const visibilityLayer = this.initializeVisibilityLayer(analysisView);

        // ADD LAYERS TO MAP //
        analysisView.map.addMany([obstructionsLayer, visibilityLayer, locationsLayer]);

        // BLUE LIGHTS GRADIENT //
        const blueLightGradient = this.config.blueLightGradient || [
          { "offset": "0%", "stop-color": "white", "stop-opacity": "1.00" },
          { "offset": "15%", "stop-color": "cyan", "stop-opacity": "0.85" },
          { "offset": "100%", "stop-color": "rgb(64,0,255)", "stop-opacity": "0.00" }
        ];
        this.applyGradientFill(analysisView, visibilityLayer, blueLightGradient);

        // ANALYSIS VIEW TOOLS //
        this.initializeAnalysisViewTools(analysisView);

        // SAVE ANALYSIS RESULTS AS HOSTED FEATURE LAYERS //
        this.initializeFeatureServiceUtils(analysisView);

        // ABOUT DIALOG OPTIONS COOKIE//
        const getAboutDialogOptions = () => {
          const aboutDialogCookie = cookie("aboutDialog");
          if(aboutDialogCookie) {
            return JSON.parse(aboutDialogCookie);
          } else {
            setAboutDialogOptions({ hideDialog: false });
            return getAboutDialogOptions();
          }
        };
        const setAboutDialogOptions = (aboutDialogOptions) => {
          cookie("aboutDialog", JSON.stringify(aboutDialogOptions), { expires: (new Date(Date.UTC(2020, 0, 0))).toUTCString() });
        };

        // GET ABOUT DIALOG OPTIONS //
        const aboutDialogOptions = getAboutDialogOptions();
        dom.byId("hide-about-chk").checked = aboutDialogOptions.hideDialog;
        on(dom.byId("hide-about-chk"), "change", (evt) => {
          aboutDialogOptions.hideDialog = dom.byId("hide-about-chk").checked;
          setAboutDialogOptions(aboutDialogOptions);
        });

        // OPEN ABOUT DIALOG INITIALLY //
        if(aboutDialogOptions.hideDialog) {
          this.displayPointSourceDialog().then(() => {
            calcite.bus.emit("drawer:open", { id: "options-drawer" });
          });
        } else {
          dom.byId("analysis-about").click();
          calcite.bus.once("modal:close", () => {
            this.displayPointSourceDialog().then(() => {
              calcite.bus.emit("drawer:open", { id: "options-drawer" });
            });
          });
        }

        // DEBUG //
        this.debug = false;
        if(this.debug) {
          this.initializeDebugLayers(analysisView);
        }

        return analysisView;
      });

    },

    /**
     *
     */
    initFindOptimal: function (analysisView) {

      const simpleMarkerSymbol = {
        type: "simple-marker",
        style: "circle",
        color: Color.named.red,
        size: "9px",
        outline: {
          color: Color.named.transparent,
          width: 0.0
        }
      };

      const optimalFeatureLayer = new FeatureLayer({
        geometryType: "point",
        spatialReference: analysisView.spatialReference,
        objectIdField: "OBJECTID",
        displayField: "name",
        fields: [
          {
            name: "OBJECTID",
            alias: "OBJECTID",
            type: "oid"
          },
          {
            name: "count",
            alias: "Count",
            type: "integer"
          },
          {
            name: "longitude",
            alias: "Longitude",
            type: "double"
          },
          {
            name: "latitude",
            alias: "Latitude",
            type: "double"
          }
        ],
        source: [],
        popupEnabled: true,
        popupTemplate: {
          title: "{count}",
          content: "{*}"
        },
        renderer: new SimpleRenderer({
          symbol: simpleMarkerSymbol,
          visualVariables: [
            {
              type: "color",
              field: "count",
              stops: [
                { value: 0, color: Color.named.white.concat(0.5) },
                { value: 100, color: Color.named.red.concat(0.9) }
              ]
            }
          ]
        })
      });
      analysisView.map.add(optimalFeatureLayer);

      this.clearOptimalResults = () => {
        optimalFeatureLayer.source.removeAll();
      };
      this.addOptimalResult = (location, count) => {
        optimalFeatureLayer.source.add(new Graphic({ geometry: location, attributes: { count: count, longitude: location.longitude, latitude: location.latitude } }));
      };
      this.updateResultsRenderer = (rangeInfo) => {
        optimalFeatureLayer.renderer = new SimpleRenderer({
          symbol: simpleMarkerSymbol,
          visualVariables: [
            {
              type: "color",
              field: "count",
              stops: [
                { value: rangeInfo.min, color: Color.named.black },
                { value: rangeInfo.max, color: Color.named.lime }
              ]
            },
            {
              type: "opacity",
              field: "count",
              stops: [
                { value: rangeInfo.min, opacity: 0.0 },
                { value: rangeInfo.max, opacity: 1.0 }
              ]
            }
          ]
        })
      };

      const tempGraphicsLayer = new GraphicsLayer();
      analysisView.map.add(tempGraphicsLayer);

      const sketch = new SketchViewModel({
        view: analysisView,
        layer: tempGraphicsLayer,
        pointSymbol: simpleMarkerSymbol,
        polylineSymbol: {
          type: "simple-line",  // autocasts as new SimpleMarkerSymbol()
          color: "#8A2BE2",
          width: "4",
          style: "dash"
        },
        polygonSymbol: {
          type: "simple-fill",
          color: Color.named.red.concat(0.1),
          style: "solid",
          outline: {
            style: "dash",
            color: Color.named.red,
            width: 2.5
          }
        }
      });
      this.clearOptimalSketch = () => {
        sketch.reset();
        tempGraphicsLayer.removeAll();
      };
      this.sketchOptimalAOI = () => {
        this.clearOptimalResults();
        tempGraphicsLayer.removeAll();
        sketch.create("polygon");
      };
      sketch.on("draw-complete", (evt) => {

        const aoiPolygon = evt.geometry.clone();
        if(!aoiPolygon.isClockwise(aoiPolygon.rings[0])) {
          aoiPolygon.rings[0].reverse();
          evt.graphic.geometry = aoiPolygon.clone();
        }

        sketch.reset();
        tempGraphicsLayer.add(evt.graphic);
        this.toggleFindOptimalButton();
        this.findOptimalLocations(analysisView, aoiPolygon);
      });

      // FIND OPTIMAL NODE //
      const findOptimalNode = domConstruct.create("div", { className: "panel panel-whiteX padding-leader-quarter padding-trailer-quarter" });
      analysisView.ui.add(findOptimalNode, { position: "top-left", index: 0 });

      // FIND OPTIMAL BUTTON//
      const findOptimalBtn = domConstruct.create("button", { className: "btn btn-clear icon-ui-filter", innerHTML: "Find Optimal (in-development)" }, findOptimalNode);
      on(findOptimalBtn, "click", () => {
        domClass.toggle(findOptimalBtn, "btn-red");
        if(domClass.contains(findOptimalBtn, "btn-red")) {
          this.sketchOptimalAOI();
        } else {
          this.clearOptimalSketch();
        }
      });
      this.toggleFindOptimalButton = () => {
        domClass.toggle(findOptimalBtn, "btn-red");
      };

      // CLEAR FIND OPTIMAL //
      const clearFindOptimalBtn = domConstruct.create("span", { className: "icon-ui-close icon-ui-red icon-ui-flush esri-interactive margin-left-half", title: "Clear Find Optimal..." }, findOptimalNode);
      on(clearFindOptimalBtn, "click", () => {
        this.clearOptimalSketch();
        this.clearOptimalResults();
      });

      // FIND OPTIMAL INFO //
      const findOptimalInfo = domConstruct.create("span", { className: "icon-ui-question icon-ui-blue icon-ui-flush esri-interactive margin-left-half", title: "Learn about Find Optimal..." }, findOptimalNode);
      on(findOptimalInfo, "click", () => {
        calcite.bus.emit("modal:open", "find-optimal-dialog");
      });

    },

    /**
     *
     * @param analysisView
     * @param analysisArea
     */
    findOptimalLocations: function (analysisView, analysisArea) {

      this.progressUI.title = "Finding Optimal Locations";
      this.progressUI.value = 0;
      this.progressUI.visible = true;

      // ANALYSIS DISTANCE //
      const analysisDistanceMeters = dom.byId("analysis-distance-input").valueAsNumber;

      // ANALYSIS AREA //
      //const aoiBuffer = geometryEngine.geodesicBuffer(aoi, analysisDistanceMeters, "meters", true);
      const analysisExtent = analysisArea.extent;

      // ADD VISIBLE AREAS TO FIND OPTIMAL OBSTRUCTIONS //
      const visibilityLayer = this.getVisibilityLayer();
      const optimalObstructions = visibilityLayer.source.reduce((obstructions, visibilityFeature) => {
        return obstructions.concat(visibilityFeature.geometry);
      }, [...this.obstructions]);

      this.findObstructionLocations(optimalObstructions, analysisArea).then((validSearchAreaObstructions) => {
        this.progressUI.label = "Generating locations in search area...";

        const step = Math.min(analysisExtent.width, analysisExtent.height) / 40;
        const locations = [];
        for (let y = analysisExtent.ymax; y > analysisExtent.ymin; y -= step) {
          for (let x = analysisExtent.xmin; x < analysisExtent.xmax; x += step) {
            const location = new Point({ spatialReference: analysisExtent.spatialReference, x: x, y: y });
            if(analysisArea.contains(location)) {
              locations.push(location);
            }
          }
        }

        this.progressUI.label = "Calculating visible areas...";
        this.progressUI.value = 0;
        this.progressUI.max = locations.length;

        const locationsInfosHandles = locations.map((location) => {
          return this.findObstructionLocations(validSearchAreaObstructions, location).then((buildingIntersections) => {
            if(buildingIntersections.length === 0) {
              return this.calculateVisibleAreaAsync(validSearchAreaObstructions, location, analysisDistanceMeters, this.ANALYSIS_RESOLUTION.FAST).then((visibleAreaInfo) => {
                ++this.progressUI.value;
                return [location, visibleAreaInfo.visibleArea];
              });
            } else {
              ++this.progressUI.value;
              return promiseUtils.resolve();
            }
          });
        });

        promiseUtils.eachAlways(locationsInfosHandles).then((locationsInfosResults) => {

          const locationInfos = locationsInfosResults.reduce((results, locationsInfosResult) => {
            if(locationsInfosResult.value) {
              results.push(locationsInfosResult.value);
            }
            return results;
          }, []);

          const results = new Map(locationInfos);

          this.progressUI.label = "Calculating visibility scores...";
          this.progressUI.value = 0;
          this.progressUI.max = results.size;

          const counts = [];
          const allLocations = [...results.keys()];

          const calculateScoreHandles = allLocations.map((location) => {
            const visibleArea = results.get(location);
            return this.findObstructionLocations(allLocations, visibleArea).then((locationsInVisibleArea) => {
              ++this.progressUI.value;
              counts.push(locationsInVisibleArea.length);
              return { location: location, count: locationsInVisibleArea.length }
            });
          });

          promiseUtils.eachAlways(calculateScoreHandles).then((calculateScoreResults) => {
            this.updateResultsRenderer({
              min: Math.min(...counts),
              max: Math.max(...counts)
            });
            calculateScoreResults.forEach((calculateScoreResult) => {
              const scoreInfo = calculateScoreResult.value;
              this.addOptimalResult(scoreInfo.location, scoreInfo.count);
            });
            this.progressUI.visible = false;
          });
        });
      });
    },

    /**
     *
     * @param view
     */
    initializeFeatureServiceUtils: function (view) {

      // MESSAGES PANEL //
      const messageNode = dom.byId("messages-node");
      const messageStep = dom.byId("messages-step");
      const displayMessage = (evt) => {
        domClass.toggle(messageNode, "text-red", ((evt.isError != null) && evt.isError));
        messageNode.innerHTML = evt.message || "";
        domClass.toggle(messageStep, "hide", (evt.step < 0));
        messageStep.value = Math.max(0, evt.step);
      };

      //
      // HOSTED FEATURE SERVICE UTILS //
      //
      const hostedFeatureServiceUtils = new HostedFeatureServiceUtils({ portal: this.portal });
      // PROGRESS MESSAGES //
      hostedFeatureServiceUtils.on("message", displayMessage);


      // VALIDATE LAYER NAME //
      const layerNameInput = dom.byId("bluelight-layer-name");
      const locationsLayerNameInput = dom.byId("locations-layer-name");
      const visibilityLayerNameInput = dom.byId("visibility-layer-name");
      const layerNameInputMessage = dom.byId("bluelight-layer-name-message");
      const resetLayerNameInput = () => {
        layerNameInput.value = "Blue Light";
        layerNameInput.dispatchEvent(new Event("input"));
      };
      const validateLayerNameInput = () => {
        domClass.remove(locationsLayerNameInput, "input-success");
        domClass.remove(locationsLayerNameInput, "input-error");
        domClass.remove(visibilityLayerNameInput, "input-success");
        domClass.remove(visibilityLayerNameInput, "input-error");
        domClass.remove(layerNameInputMessage, "is-active");

        const layerName = layerNameInput.value;
        if(layerName && (layerName.length > 0)) {
          locationsLayerNameInput.value = `${layerName} Locations`;
          visibilityLayerNameInput.value = `${layerName} Visibility`;

          hostedFeatureServiceUtils.isServiceNameAvailable(locationsLayerNameInput.value).then((locationNameAvailable) => {
            domClass.toggle(locationsLayerNameInput, "input-success", locationNameAvailable);
            domClass.toggle(locationsLayerNameInput, "input-error", !locationNameAvailable);

            hostedFeatureServiceUtils.isServiceNameAvailable(visibilityLayerNameInput.value).then((visibilityNameAvailable) => {
              domClass.toggle(visibilityLayerNameInput, "input-success", visibilityNameAvailable);
              domClass.toggle(visibilityLayerNameInput, "input-error", !visibilityNameAvailable);

              domClass.toggle(layerNameInputMessage, "is-active", !(locationNameAvailable && visibilityNameAvailable));
              this.toggleSaveBtn();
            });
          });

        } else {
          domClass.add(locationsLayerNameInput, "input-error");
          domClass.add(locationsLayerNameInput, "input-error");
          this.toggleSaveBtn();
        }
      };
      on(layerNameInput, "input", validateLayerNameInput);
      validateLayerNameInput();


      // CREATE LINK TO NEW HOSTED FEATURE LAYER ITEM //
      const createFeatureLayerLink = (newFeatureLayer) => {
        // PHOTOLAYER NODE //
        const featureLayerNode = domConstruct.create("li", {}, "feature-layer-links");
        featureLayerNode.scrollIntoView(true);

        // LINK TO ITEM //
        domConstruct.create("a", {
          className: "icon-ui-feature-layer",
          href: `https://${this.portal.urlKey}.${this.portal.customBaseUrl}/home/item.html?id=${newFeatureLayer.portalItem.id}`,
          target: "_blank",
          innerHTML: newFeatureLayer.title
        }, featureLayerNode);

      };

      // SAVE ANALYSIS RESULTS //
      const saveResultsBtn = dom.byId("save-results-btn");
      this.toggleSaveBtn = () => {
        const hasSignedInUser = (this.portal.user != null);
        const invalidLayerNames = domClass.contains(layerNameInputMessage, "is-active");
        domClass.toggle(saveResultsBtn, "btn-disabled", !hasSignedInUser || invalidLayerNames);
      };
      // SAVE BTN CLICK //
      on(saveResultsBtn, "click", () => {
        if(!domClass.contains(saveResultsBtn, "btn-disabled")) {

          // DESTINATION FOLDER //
          const destinationFolderId = dom.byId("folder-select").value || "/";

          // BLUE LIGHTS LAYER //
          const templateBlueLightLocationsItemId = "cf57efb7117146768598cadcbeaf9b04";
          const blueLightLocationsLayer = this.getBlueLightLocationsLayer();
          blueLightLocationsLayer.title = locationsLayerNameInput.value;

          //
          // CREATE BLUE LIGHTS HOSTED LAYER //
          //
          const createLocationsParameters = {
            templateFeatureLayerItemId: templateBlueLightLocationsItemId,
            sourceFeatureLayer: blueLightLocationsLayer,
            destinationFolderId: destinationFolderId,
            attachmentInfos: null,
            resizeOption: null
          };
          hostedFeatureServiceUtils.createHostedFeatureLayer(createLocationsParameters).then((createLayerResults) => {
            Layer.fromPortalItem({ portalItem: { id: createLayerResults.itemId } }).then((featureLayer) => {
              featureLayer.load().then(() => {
                // DISPLAY LINK TO NEW HOSTED FEATURE LAYER //
                createFeatureLayerLink(featureLayer);
              });
            });

            // VISIBILITY LAYER //
            const templateBlueLightVisibilityItemId = "3e833abaa7484743a5f650783ca9172a";
            const blueLightVisibilityLayer = this.getVisibilityLayer();
            blueLightVisibilityLayer.title = visibilityLayerNameInput.value;

            //
            // CREATE VISIBILITY HOSTED LAYER //
            //
            const createVisibilityParameters = {
              templateFeatureLayerItemId: templateBlueLightVisibilityItemId,
              sourceFeatureLayer: blueLightVisibilityLayer,
              destinationFolderId: destinationFolderId,
              attachmentInfos: null,
              resizeOption: null
            };
            this.setVisibilityRenderer(true);
            hostedFeatureServiceUtils.createHostedFeatureLayer(createVisibilityParameters).then((createLayerResults) => {
              this.setVisibilityRenderer(false);
              Layer.fromPortalItem({ portalItem: { id: createLayerResults.itemId } }).then((featureLayer) => {
                featureLayer.load().then(() => {
                  // DISPLAY LINK TO NEW HOSTED FEATURE LAYER //
                  createFeatureLayerLink(featureLayer);
                });
              });

              // RESET LAYER NAME INPUT //
              resetLayerNameInput();

              // CLEAR MESSAGE AFTER 5 SECONDS //
              setTimeout(() => {
                displayMessage({ step: -1, message: null });
              }, 5000);
            });

          });
        }
      });

    },

    /**
     *
     */
    initializeUserFolders: function () {

      if(this.portal && this.portal.user) {
        // PORTAL FOLDER //
        this.portal.user.fetchFolders().then((userFolders) => {
          // ADD ROOT FOLDER //
          userFolders.unshift({ id: "/", title: `[ ${this.portal.user.username} ]` });
          const candidateFolderIds = [];
          // CREATE FOLDER SELECT OPTIONS //
          userFolders.forEach((userFolder) => {
            if(/campus|blue|obstructions/ig.test(userFolder.title)) {
              candidateFolderIds.push(userFolder.id);
            }
            domConstruct.create("option", {
              value: userFolder.id,
              innerHTML: userFolder.title
            }, "folder-select");
          });
          if(candidateFolderIds.length > 0) {
            dom.byId("folder-select").value = candidateFolderIds[0];
          }
          domClass.remove(dom.byId("folder-select"), "btn-disabled");
          this.toggleSaveBtn();
        });

      }

    },

    /**
     *  BLUE LIGHT LOCATIONS LAYER
     *
     * @param analysisView
     * @param layersParent
     * @returns {*}
     */
    initializeLocationsLayers: function (analysisView, layersParent) {

      /*
       const blueLightMarkerSymbol = new SimpleMarkerSymbol({
       style: "circle",
       color: Color.named.blue,
       size: "13px",
       outline: {
       color: Color.named.white.concat(0.5),
       width: "3px"
       }
       });
       */

      /*const blueLightMarkerSymbol = new SimpleMarkerSymbol({
       style: "circle",
       color: Color.named.transparent,
       size: "17px",
       outline: {
       color: Color.named.cyan.concat(0.5),
       width: 0.5
       }
       });*/

      const blueLightPictureSymbol = new PictureMarkerSymbol({
        url: "./images/BlueLightSymbolMarker.png",
        width: "22px",
        height: "22px"
      });

      // BLUE LIGHT LOCATIONS LAYER //
      const blueLightsLayer = new FeatureLayer({
        title: "Blue Light Locations",
        geometryType: "point",
        spatialReference: analysisView.spatialReference,
        objectIdField: "OBJECTID",
        displayField: "name",
        fields: [
          {
            name: "OBJECTID",
            alias: "OBJECTID",
            type: "oid"
          },
          {
            name: "name",
            alias: "Name",
            type: "string"
          },
          {
            name: "longitude",
            alias: "Longitude",
            type: "double"
          },
          {
            name: "latitude",
            alias: "Latitude",
            type: "double"
          }
        ],
        source: [],
        popupEnabled: false,
        popupTemplate: {
          title: "{name}",
          content: "{*}"
        },
        renderer: new SimpleRenderer({
          label: "Blue Light Locations",
          symbol: blueLightPictureSymbol
        })
      });

      // HIGHLIGHT //
      const highlightSymbol = new SimpleMarkerSymbol({
        style: "circle",
        color: Color.named.transparent,
        size: "25px",
        outline: {
          color: Color.named.red,
          width: 2.5
        }
      });

      const highlightLocation = (feature) => {
        analysisView.graphics.removeAll();
        analysisView.graphics.add(new Graphic({ geometry: feature.geometry, symbol: highlightSymbol }));
      };

      const clearHighlightLocation = () => {
        analysisView.graphics.removeAll();
      };

      const addBlueLightNode = (feature) => {

        const oid = feature.getAttribute("OBJECTID");
        const name = feature.getAttribute("name");

        const blueLightNode = domConstruct.create("div", {
          className: "item-node side-nav-link",
          id: "feature-id-" + oid
        }, "locations-list");
        on(blueLightNode, "click", () => {
          analysisView.goTo(this.getBlueLightFeatureByOID(oid));
        });
        on(blueLightNode, mouse.enter, () => {
          highlightLocation(this.getBlueLightFeatureByOID(oid));
        });
        on(blueLightNode, mouse.leave, () => {
          clearHighlightLocation();
        });

        // NAME //
        const nameNode = domConstruct.create("span", { className: "name-node", innerHTML: name }, blueLightNode);

        // ACTIONS //
        const actionsNode = domConstruct.create("div", { className: "item-actions right" }, blueLightNode);

        // EDIT NAME //
        const editNode = domConstruct.create("span", {
          className: "icon-ui-edit",
          title: "Edit location name..."
        }, actionsNode);
        on(editNode, "click", (editEvt) => {
          editEvt.stopPropagation();
          domClass.add(actionsNode, "hide");
          domClass.add(nameNode, "hide");

          // NAME INPUT //
          const nameInput = domConstruct.create("input", {
            type: "text",
            placeHolder: "Enter location name here...",
            value: name,
            onfocus: document.execCommand('selectall')
          }, blueLightNode);
          nameInput.focus();
          nameInput.select();
          // ERROR NODE //
          const errorNode = domConstruct.create("div", {
            className: "input-error-message",
            innerHTML: "Location name can't be empty..."
          }, blueLightNode);

          // SAVE NAME EDIT //
          const saveNameEdit = () => {
            if(nameInput.value && nameInput.value.length > 0) {
              const blueLightFeature = this.getBlueLightFeatureByOID(oid);
              blueLightFeature.setAttribute("name", nameInput.value);
              nameNode.innerHTML = nameInput.value;
              query(".csv_export_link").orphan();
            }
            domConstruct.destroy(nameInput);
            domConstruct.destroy(errorNode);
            domClass.remove(actionsNode, "hide");
            domClass.remove(nameNode, "hide");
          };
          // NAME INPUT EVENTS //
          on(nameInput, "click", (clickEvt) => {
            clickEvt.stopPropagation();
          });
          on(nameInput, "input", (inputEvt) => {
            inputEvt.stopPropagation();
            const isValid = (nameInput.value && nameInput.value.length > 0);
            domClass.toggle(nameInput, "input-error", !isValid);
            domClass.toggle(errorNode, "is-active", !isValid);
          });
          on(nameInput, "blur", (blurEvt) => {
            blurEvt.stopPropagation();
            saveNameEdit();
          });
          on(nameInput, "keyup", (keyEvt) => {
            keyEvt.stopPropagation();
            if(["Enter", "Escape"].indexOf(keyEvt.key) > -1) {
              saveNameEdit();
            }
          });

        });

        const clearNode = domConstruct.create("span", {
          className: "icon-ui-red icon-ui-close",
          title: "Remove Blue Light"
        }, actionsNode);
        on(clearNode, "click", (evt) => {
          evt.stopPropagation();
          const blueLightFeature = this.getBlueLightFeatureByOID(oid);
          //this.removeVisibleAreaCache(blueLightFeature.geometry);
          this.removeVisibleAreaCache(blueLightFeature);
          blueLightsLayer.source.remove(blueLightFeature);
          removeBlueLightNode(blueLightFeature);
        });

      };

      const removeBlueLightNode = (feature) => {
        domConstruct.destroy(`feature-id-${feature.getAttribute("OBJECTID")}`);
      };

      const updateBlueLightNode = (feature) => {
        const nameNode = query(".name-node", `feature-id-${feature.getAttribute("OBJECTID")}`)[0];
        nameNode.innerHTML = feature.getAttribute("name");
      };


      // LOCATIONS AFTER CHANGES//
      this.loadingSources = false;
      blueLightsLayer.source.on("after-changes", () => {
        if(!this.loadingSources) {

          dom.byId("blue-light-count").innerHTML = number.format(blueLightsLayer.source.length);
          domClass.toggle(dom.byId("clear-analysis-btn"), "hide", (blueLightsLayer.source.length < 2));
          domClass.toggle(dom.byId("save-analysis-btn"), "hide", (blueLightsLayer.source.length < 1));
          query(".csv_export_link").orphan();

          clearHighlightLocation();
          // UPDATE ANALYSIS AFTER CHANGES //
          this.updateBlueLightsAnalysis();
        }
      });

      const getLocationText = (location) => {
        return lang.replace("Lon:{lon} Lat:{lat}", {
          lon: location.longitude.toFixed(5),
          lat: location.latitude.toFixed(5)
        });
      };

      this.getBlueLightFeatureByOID = (oid) => {
        return blueLightsLayer.source.find((blueLightFeature) => {
          return (blueLightFeature.getAttribute("OBJECTID") === oid);
        });
      };

      this.addBlueLightLocation = (location, name) => {
        const feature = new Graphic({
          geometry: location,
          attributes: {
            OBJECTID: (new Date()).valueOf(),
            name: name || getLocationText(location),
            longitude: location.longitude,
            latitude: location.latitude
          }
        });
        addBlueLightNode(feature);

        blueLightsLayer.source.add(feature);
        return feature;
      };

      this.updateBlueLightLocation = (feature, location) => {
        blueLightsLayer.source.remove(feature);

        const newFeature = feature.clone();
        newFeature.geometry = location;

        if(newFeature.attributes.name.startsWith("Lon:")) {
          newFeature.attributes.name = getLocationText(location);
        }
        //newFeature.attributes.OBJECTID = feature.attributes.OBJECTID;
        newFeature.attributes.longitude = location.longitude;
        newFeature.attributes.latitude = location.latitude;

        blueLightsLayer.source.add(newFeature);
        updateBlueLightNode(newFeature);

        return newFeature;
      };

      this.clearBlueLightsLayer = () => {
        blueLightsLayer.source.removeAll();
        domConstruct.empty("locations-list");
        this.clearVisibleAreaCaches();
      };

      this.hasBlueLightLocations = () => {
        return (blueLightsLayer.source.length > 0);
      };

      this.getBlueLightLocations = () => {
        //return blueLightsLayer.source;
        return blueLightsLayer.source.map((blueLightFeature) => {
          return blueLightFeature.geometry;
        });
      };

      this.getBlueLightsAsCSVItems = (itemDelim, lineDelim) => {
        const itemDelimiter = itemDelim || ",";
        const lineDelimiter = lineDelim || "\n";

        // FIELD INFOS //
        const fieldInfos = blueLightsLayer.fields.reduce((infos, field) => {
          infos.fieldNames.push(`"${field.name}"`);
          infos.needsQuotes[field.name] = (field.type === "string");
          return infos;
        }, { fieldNames: [], needsQuotes: [] });

        // FIELD NAMES //
        const fieldNames = fieldInfos.fieldNames.join(itemDelimiter);

        // ATTRIBUTE VALUES //
        const attributeValues = blueLightsLayer.source.map((feature) => {
          return Object.keys(feature.attributes).map((attributeName) => {
            let attributeValue = feature.attributes[attributeName];
            return fieldInfos.needsQuotes[attributeName] ? `"${attributeValue}"` : attributeValue;
          }).join(itemDelimiter);
        }).join(lineDelimiter);

        return [fieldNames, attributeValues].join(lineDelimiter);
      };

      this.getBlueLightLocationsLayer = () => {
        return blueLightsLayer;
      };

      const pointFeatureLayers = layersParent.layers.filter(function (layer) {
        return ((layer.type === "feature") && (layer.geometryType === "point"));
      });
      this.displayPointSourceDialog = () => {
        const deferred = new Deferred();

        if(pointFeatureLayers.length > 0) {

          pointFeatureLayers.forEach((pointFeatureLayer) => {
            //const isCandidate = /blue|light|location|/ig.test(pointFeatureLayer.title);
            domConstruct.create("input", {
              className: "points-source-input",
              type: "radio",
              name: "points-source",
              checked: false,
              value: pointFeatureLayer.id
            }, domConstruct.create("label", {
              className: "esri-interactive",
              innerHTML: pointFeatureLayer.title
            }, "points-source-list"));
          });

          calcite.bus.emit("modal:open", "use-points-dialog");
          on.once(dom.byId("point-source-btn"), "click", () => {
            domClass.add("point-source-btn", "btn-disabled");

            const pointSourceLayers = query(".points-source-input:checked").reduce((layers, input) => {
              return layers.concat(layersParent.findLayerById(input.value));
            }, []);
            if(pointSourceLayers.length > 0) {

              dom.byId("point-source-label").innerHTML = "Loading Blue Light sources...";
              domClass.remove("point-source-load", "hide");

              const pointSourceLayer = pointSourceLayers[0];
              dom.byId("point-source-input").value = pointSourceLayer.title;
              domClass.toggle("point-source-input", "input-error input-success");

              const allPointsQuery = pointSourceLayer.createQuery();
              allPointsQuery.outSpatialReference = analysisView.spatialReference;
              allPointsQuery.where = "1=1";
              pointSourceLayer.queryFeatures(allPointsQuery).then((pointSourceFeatureSet) => {
                dom.byId("point-source-label").innerHTML = `Loading ${pointSourceFeatureSet.features.length} Blue Light sources...`;

                this.loadingSources = (pointSourceFeatureSet.features.length > 0);
                pointSourceFeatureSet.features.forEach((feature, featureIndex) => {
                  if(featureIndex === (pointSourceFeatureSet.features.length - 1)) {
                    this.loadingSources = false;
                  }
                  this.addBlueLightLocation(feature.geometry, feature.getAttribute(pointSourceLayer.displayField));
                });

                domClass.add("point-source-load", "hide");
                calcite.bus.emit("modal:close", "use-points-dialog");
                deferred.resolve();
              });
            } else {
              dom.byId("point-source-input").placeholder = "no point feature layer selected on startup";
              calcite.bus.emit("modal:close", "use-points-dialog");
              deferred.resolve();
            }
          });
        }

        return deferred.promise;
      };


      // AOI //
      const aoiLayerSelect = dom.byId("aoi-layer-select");
      const aoiLocationSelect = dom.byId("aoi-location-select");

      this.aoiFeatureCandidates = new Map();

      const aoiFeatureLayers = layersParent.layers.filter(function (layer) {
        return ((layer.type === "feature") && (layer.geometryType === "polygon"));
      });
      if(aoiFeatureLayers.length > 0) {
        aoiFeatureLayers.forEach((aoiFeatureLayer) => {
          domConstruct.create("option", {
            innerHTML: aoiFeatureLayer.title,
            value: aoiFeatureLayer.id
          }, aoiLayerSelect);
        });
      }

      const getAOILayer = () => {
        const aoiLayerId = aoiLayerSelect.value;
        if(aoiLayerId === "current-map-extent") {
          return null;
        } else {
          return layersParent.findLayerById(aoiLayerId);
        }
      };

      on(aoiLayerSelect, "change", () => {
        const aoiLayer = getAOILayer();
        domClass.toggle("aoi-location", "hide", (aoiLayer == null));

        if(aoiLayer) {
          domConstruct.empty(aoiLocationSelect);

          const objectIdField = aoiLayer.objectIdField;

          const locationNameFields = ["id", "name", "title", "description"];
          const stringFields = aoiLayer.fields.filter((field) => {
            return (field.type === "string");
          });
          stringFields.sort((a, b) => {
            return locationNameFields.indexOf(b.name.toLowerCase()) - locationNameFields.indexOf(a.name.toLowerCase());
          });
          const displayField = (stringFields.length > 0) ? stringFields[0].name : objectIdField;

          this.aoiFeatureCandidates = new Map();

          aoiLayer.queryFeatures().then((aoiFeatureSet) => {
            const aoiFeatures = aoiFeatureSet.features;
            aoiFeatures.forEach((aoiFeature) => {

              const oid = aoiFeature.getAttribute(objectIdField);
              this.aoiFeatureCandidates.set(oid, aoiFeature);

              let label = String(aoiFeature.getAttribute(displayField));
              if(label.length === 0 || label === "null") {
                label = `Feature #${oid}`;
              }

              domConstruct.create("option", {
                innerHTML: label,
                value: oid
              }, aoiLocationSelect);
            });
            if(aoiFeatures.length > 0) {
              this.emit("coverage-update", { type: "area-of-interest", areaOfInterest: aoiFeatures[0].geometry });
            }
          });
        } else {
          this.emit("coverage-update", { type: "current-map-extent", areaOfInterest: null });
        }
      });

      on(aoiLocationSelect, "change", () => {
        const aoiFeature = this.aoiFeatureCandidates.get(+aoiLocationSelect.value);
        this.emit("coverage-update", { type: "area-of-interest", areaOfInterest: aoiFeature.geometry });
      });

      /*this.displayAOISourceDialog = () => {
        const deferred = new Deferred();

        if(aoiFeatureLayers.length > 0) {

          aoiFeatureLayers.forEach((aoiFeatureLayer) => {
            //const isCandidate = /blue|light|location|/ig.test(pointFeatureLayer.title);
            domConstruct.create("input", {
              className: "aoi-layer-input",
              type: "radio",
              name: "aoi-layer",
              checked: false,
              value: aoiFeatureLayer.id
            }, domConstruct.create("label", {
              innerHTML: aoiFeatureLayer.title
            }, "aoi-layer-list"));
          });

          calcite.bus.emit("modal:open", "aoi-layer-dialog");
          on.once(dom.byId("aoi-layer-btn"), "click", () => {
            domClass.add("aoi-layer-btn", "btn-disabled");

            const aoiSourceLayers = query(".aoi-layer-input:checked").reduce((layers, input) => {
              return layers.concat(layersParent.findLayerById(input.value));
            }, []);
            if(aoiSourceLayers.length > 0) {

              const aoiSourceLayer = aoiSourceLayers[0];

              this.getAOILayer = () => {
                return aoiSourceLayer;
              };


              /!*dom.byId("point-source-input").value = pointSourceLayer.title;
              domClass.toggle("point-source-input", "input-error input-success");

              const allPointsQuery = pointSourceLayer.createQuery();
              allPointsQuery.outSpatialReference = analysisView.spatialReference;
              allPointsQuery.where = "1=1";
              pointSourceLayer.queryFeatures(allPointsQuery).then((pointSourceFeatureSet) => {
                dom.byId("point-source-label").innerHTML = `Loading ${pointSourceFeatureSet.features.length} Blue Light sources...`;

                this.loadingSources = (pointSourceFeatureSet.features.length > 0);
                pointSourceFeatureSet.features.forEach((feature, featureIndex) => {
                  if(featureIndex === (pointSourceFeatureSet.features.length - 1)) {
                    this.loadingSources = false;
                  }
                  this.addBlueLightLocation(feature.geometry, feature.getAttribute(pointSourceLayer.displayField));
                });*!/


              calcite.bus.emit("modal:close", "aoi-layer-dialog");
              deferred.resolve();
              //});
            } else {
              //dom.byId("point-source-input").placeholder = "no source point feature layer selected on startup";
              calcite.bus.emit("modal:close", "aoi-layer-dialog");
              deferred.resolve();
            }
          });
        }
        return deferred.promise;
      };*/

      return blueLightsLayer;
    },

    /**
     *
     * @param analysisView
     */
    initializeDebugLayers: function (analysisView) {

      const intersectionsLayer = new FeatureLayer({
        title: "Intersections",
        visible: false,
        objectIdField: "OBJECTID",
        geometryType: "point",
        spatialReference: analysisView.spatialReference,
        fields: [
          {
            name: "OBJECTID",
            alias: "OBJECTID",
            type: "oid"
          },
          {
            name: "nearest",
            alias: "nearest",
            type: "string"
          }
        ],
        source: [],
        popupEnabled: false,
        renderer: new UniqueValueRenderer({
          field: "nearest",
          defaultSymbol: new SimpleMarkerSymbol({
            style: "circle",
            color: Color.named.transparent,
            size: "6px",
            outline: {
              color: Color.named.white,
              width: "1px"
            }
          }),
          uniqueValueInfos: [
            {
              value: "nearest",
              symbol: new SimpleMarkerSymbol({
                style: "circle",
                color: Color.named.red,
                size: "9px",
                outline: {
                  color: Color.named.white,
                  width: "1px"
                }
              })
            }
          ]
        })
      });
      const clearIntersections = () => {
        intersectionsLayer.source.removeAll();
      };
      this.addIntersection = (intersection, isNearest) => {
        intersectionsLayer.source.add(new Graphic({ geometry: intersection, attributes: { nearest: isNearest ? "nearest" : "not-nearest" } }))
      };

      const sightlineLayer = new FeatureLayer({
        title: "Sightlines",
        visible: false,
        objectIdField: "OBJECTID",
        geometryType: "polyline",
        spatialReference: analysisView.spatialReference,
        fields: [
          {
            name: "OBJECTID",
            alias: "OBJECTID",
            type: "oid"
          }
        ],
        source: [],
        popupEnabled: false,
        renderer: new SimpleRenderer({
          symbol: new SimpleLineSymbol({
            style: "solid",
            color: Color.named.orange,
            width: 1.5
          })
        })
      });
      const clearSightlines = () => {
        sightlineLayer.source.removeAll();
      };
      this.addSightline = (sightline) => {
        sightlineLayer.source.add(new Graphic({ geometry: sightline }))
      };

      analysisView.map.addMany([sightlineLayer, intersectionsLayer]);

      this.clearDebug = () => {
        clearIntersections();
        clearSightlines();
      };

      const debugIntersectionsToggle = domConstruct.create("button", { className: "btn btn-small btn-green", innerHTML: "Intersecitons" });
      analysisView.ui.add(debugIntersectionsToggle, "bottom-right");
      on(debugIntersectionsToggle, "click", () => {
        domClass.toggle(debugIntersectionsToggle, "icon-ui-check-mark");
        intersectionsLayer.visible = (!intersectionsLayer.visible);
        this.updateBlueLightsAnalysis();
        this.toggleVisibilityLayer(!(intersectionsLayer.visible || sightlineLayer.visible));
      });

      const debugSightlinesToggle = domConstruct.create("button", { className: "btn btn-small btn-green", innerHTML: "Sightlines" });
      analysisView.ui.add(debugSightlinesToggle, "bottom-right");
      on(debugSightlinesToggle, "click", () => {
        domClass.toggle(debugSightlinesToggle, "icon-ui-check-mark");
        sightlineLayer.visible = (!sightlineLayer.visible);
        this.updateBlueLightsAnalysis();
        this.toggleVisibilityLayer(!(intersectionsLayer.visible || sightlineLayer.visible));
      });

    },

    /**
     *
     */
    initializeVisibleAreasCaches: function () {

      // VISIBLE AREAS CACHE //
      const visibleAreaInfosCaches = new Map();
      visibleAreaInfosCaches.set(this.ANALYSIS_RESOLUTION.FAST, new Map());
      visibleAreaInfosCaches.set(this.ANALYSIS_RESOLUTION.NORMAL, new Map());
      visibleAreaInfosCaches.set(this.ANALYSIS_RESOLUTION.FINEST, new Map());

      // SET //
      const setVisibleAreaCache = (analysisResolution, blueLightLocation, visibleAreaInfos) => {
        visibleAreaInfosCaches.get(analysisResolution).set(blueLightLocation, visibleAreaInfos);
      };

      // GET //
      this.getVisibleAreaByLocation = (blueLightLocation, analysisDistanceMeters, analysisResolution) => {

        const visibleAreasCache = visibleAreaInfosCaches.get(analysisResolution);

        if(visibleAreasCache.has(blueLightLocation)) {
          return visibleAreasCache.get(blueLightLocation);

        } else {

          const visibleAreaInfo = this.calculateVisibleArea(blueLightLocation, analysisDistanceMeters, analysisResolution);
          setVisibleAreaCache(analysisResolution, blueLightLocation, visibleAreaInfo);

          return visibleAreaInfo;
        }
      };

      // REMOVE //
      this.removeVisibleAreaCache = (blueLightLocation) => {
        //this.removeVisibilityGraphic(blueLightLocation);
        visibleAreaInfosCaches.get(this.ANALYSIS_RESOLUTION.FAST).delete(blueLightLocation);
        visibleAreaInfosCaches.get(this.ANALYSIS_RESOLUTION.NORMAL).delete(blueLightLocation);
        visibleAreaInfosCaches.get(this.ANALYSIS_RESOLUTION.FINEST).delete(blueLightLocation);
      };

      // CLEAR //
      this.clearVisibleAreaCaches = () => {
        //this.clearVisibilityGraphics();
        visibleAreaInfosCaches.get(this.ANALYSIS_RESOLUTION.FAST).clear();
        visibleAreaInfosCaches.get(this.ANALYSIS_RESOLUTION.NORMAL).clear();
        visibleAreaInfosCaches.get(this.ANALYSIS_RESOLUTION.FINEST).clear();
      };

    },

    /**
     * VISIBILITY LAYER
     *
     * @param analysisView
     * @returns {*}
     */
    initializeVisibilityLayer: function (analysisView) {

      this.initializeVisibleAreasCaches();

      const allVisibleSymbol = new SimpleFillSymbol({
        color: Color.named.transparent,
        style: "solid",
        outline: {
          style: "solid",
          color: Color.named.cyan,
          width: 1.0
        }
      });

      const visibleSymbol = new SimpleFillSymbol({
        color: Color.named.cyan,
        style: "solid",
        outline: {
          color: Color.named.transparent,
          width: 0.0
        }
      });
      const visibleWithOutlineSymbol = new SimpleFillSymbol({
        color: Color.named.cyan,
        style: "solid",
        outline: {
          color: Color.named.red,
          width: 1.0
        }
      });
      const visibilityRenderer = new UniqueValueRenderer({
        field: "type",
        uniqueValueInfos: [
          {
            value: "single",
            label: "Blue Light Visible",
            symbol: visibleSymbol
          },
          {
            value: "overlap",
            label: "Blue Light Visible with Overlap",
            symbol: visibleWithOutlineSymbol
          },
          {
            value: "all",
            label: "Campus Visibility",
            symbol: allVisibleSymbol
          }
        ]
      });

      const visibleSymbolForExport = new SimpleFillSymbol({
        color: Color.named.cyan.concat(0.2),
        style: "solid",
        outline: {
          color: Color.named.transparent,
          width: 0.0
        }
      });
      const visibilityRendererForExport = new UniqueValueRenderer({
        field: "type",
        uniqueValueInfos: [
          {
            value: "single",
            label: "Blue Light Visible",
            symbol: visibleSymbolForExport
          },
          {
            value: "overlap",
            label: "Blue Light Visible with Overlap",
            symbol: visibleSymbolForExport
          },
          {
            value: "all",
            label: "Campus Visibility",
            symbol: allVisibleSymbol
          }
        ]
      });

      //
      // TOD0: GET DEFINITIONS FROM LAYER ITEM...
      //
      const visibilityLayer = new FeatureLayer({
        title: "Blue Light Visibility",
        geometryType: "point",
        spatialReference: analysisView.spatialReference,
        objectIdField: "OBJECTID",
        displayField: "name",
        fields: [
          {
            name: "OBJECTID",
            alias: "OBJECTID",
            type: "oid"
          },
          {
            name: "name",
            alias: "Name",
            type: "string"
          },
          {
            name: "type",
            alias: "Type",
            type: "string"
          },
          {
            name: "centerOffsets",
            alias: "Center Offsets",
            type: "string"
          },
          {
            name: "AreaSqFt",
            alias: "Area SqFt",
            type: "double"
          }
        ],
        source: [],
        popupEnabled: false,
        popupTemplate: {
          title: "{name}: {type}",
          content: [
            {
              type: "fields"
            }
          ]
        },
        renderer: visibilityRenderer
      });

      this.setVisibilityRenderer = (forExport) => {
        visibilityLayer.renderer = forExport ? visibilityRendererForExport : visibilityRenderer;
      };

      this.getVisibilityLayer = () => {
        return visibilityLayer;
      };

      this.toggleVisibilityLayer = (visible) => {
        visibilityLayer.visible = visible;
      };

      // CLEAR VISIBILITY FEATURES //
      this.clearVisibilityGraphics = () => {
        visibilityLayer.source.removeAll();
      };

      // ADD VISIBILITY FEATURE //
      this.addVisibilityGraphic = (visibilityGraphic) => {
        const areaSqFt = geometryEngine.geodesicArea(visibilityGraphic.geometry, "square-feet");
        visibilityGraphic.setAttribute("AreaSqFt", Math.round(areaSqFt));
        visibilityLayer.source.add(visibilityGraphic);
      };
      this.removeVisibilityGraphic = (visibilityGraphic) => {
        visibilityLayer.source.remove(visibilityGraphic);
      };

      //
      // UPDATE ANALYSIS ASYNC //
      //
      this.updateBlueLightsAnalysis = (analysisResolution) => {
        if(this.debug) {
          this.clearDebug();
        }

        this.clearVisibilityGraphics();

        if(this.updateAnalysisHandle && !this.updateAnalysisHandle.isFulfilled()) {
          this.updateAnalysisHandle.cancel();
        }
        this.updateAnalysisHandle = _updateBlueLightsAnalysis(analysisResolution);
      };

      // UPDATE ANALYSIS //
      const _updateBlueLightsAnalysis = (analysisResolution) => {
        const deferred = new Deferred();

        if(this.hasObstructions() && this.hasBlueLightLocations()) {

          // ANALYSIS RESOLUTION //
          analysisResolution = (analysisResolution || this.ANALYSIS_RESOLUTION.NORMAL);

          // ANALYSIS DISTANCE //
          const analysisDistanceMeters = dom.byId("analysis-distance-input").valueAsNumber;

          // GET BLUE LIGHT LOCATIONS //
          const blueLightLocations = this.getBlueLightLocations();

          // PROCESS EACH BLUE LIGHT LOCATION //
          const visibleAreasInfos = blueLightLocations.reduce((areasInfos, blueLightLocation) => {

            // VISIBLE AREAS INFOS /
            const visibleAreaInfo = this.getVisibleAreaByLocation(blueLightLocation, analysisDistanceMeters, analysisResolution);

            // UPDATE AREAS INFOS //
            areasInfos.visibleAreas = areasInfos.visibleAreas.concat(visibleAreaInfo.visibleArea);
            areasInfos.visibleAreasSqFt += geometryEngine.geodesicArea(visibleAreaInfo.visibleArea, "square-feet");

            // VISIBLE AREA GRAPHICS //
            const visibleAreaGraphic = new Graphic({
              geometry: visibleAreaInfo.visibleArea,
              attributes: { type: "single", centerOffsets: JSON.stringify(visibleAreaInfo.centerOffsets) }
            });
            areasInfos.visibleGraphics.push(visibleAreaGraphic);

            return areasInfos;
          }, { visibleAreas: [], visibleAreasSqFt: 0.0, visibleGraphics: [] });


          // DISPLAY VISIBLE AREAS //
          visibleAreasInfos.visibleGraphics.forEach(this.addVisibilityGraphic);

          // VISIBLE AREAS AS MULTIPART POLYGON //
          const visibleAreasPolygon = new Polygon({
            spatialReference: analysisView.spatialReference,
            rings: []
          });

          // IS SELF INTERSECTING //
          let selfIntersecting = false;
          visibleAreasInfos.visibleAreas.forEach((visibleArea) => {
            if(geometryEngine.intersects(visibleAreasPolygon, visibleArea)) {
              selfIntersecting = true;
            }
            visibleAreasPolygon.addRing(visibleArea.rings[0]);
          });

          // VISIBLE AREAS UNION //
          const visibleAreasUnion = selfIntersecting ? geometryEngine.union(visibleAreasInfos.visibleAreas) : visibleAreasPolygon;

          if(!this.allVisibilityGraphic) {
            this.allVisibilityGraphic = new Graphic({ geometry: visibleAreasUnion, attributes: { type: "all", centerOffsets: null } });
            this.addVisibilityGraphic(this.allVisibilityGraphic);
          } else {
            this.removeVisibilityGraphic(this.allVisibilityGraphic);
            this.allVisibilityGraphic = this.allVisibilityGraphic.clone();
            this.allVisibilityGraphic.geometry = visibleAreasUnion;
            this.addVisibilityGraphic(this.allVisibilityGraphic);
          }
          //this.addVisibilityGraphic(new Graphic({ geometry: visibleAreasUnion, attributes: { type: "all", centerOffsets: null } }));

          // VISIBLE AREAS UNION AREA MEASUREMENTS //
          const visibleAreasUnionSqFt = geometryEngine.geodesicArea(visibleAreasUnion, "square-feet");
          dom.byId("all-area").innerHTML = number.format(visibleAreasUnionSqFt, { places: 0 });

          // OVERLAP AREA MEASUREMENTS //
          const overlapAreaSqFt = Math.abs(visibleAreasInfos.visibleAreasSqFt - visibleAreasUnionSqFt);
          dom.byId("overlap-area").innerHTML = number.format(overlapAreaSqFt, { places: 0 });
          dom.byId("overlap-area-percent").innerHTML = `${number.format((overlapAreaSqFt / visibleAreasUnionSqFt) * 100, { places: 1 })} %`;

          // COVERAGE //
          this.coverageOptions.visibleAreasUnion = visibleAreasUnion;
          this.updateCoverage();

          deferred.resolve();
        } else {
          dom.byId("all-area").innerHTML = "0";
          dom.byId("overlap-area").innerHTML = "0";
          dom.byId("overlap-area-percent").innerHTML = "0.0 %";
          dom.byId("coverage-area-percent").innerHTML = "0.0 %";
          deferred.resolve();
        }

        return deferred.promise;
      };

      // UPDATE COVERAGE STAT //
      this.updateCoverage = () => {
        const visibleAreasUnion = this.coverageOptions.visibleAreasUnion;
        if(visibleAreasUnion) {

          if(this.coverageOptions.type === "current-map-extent") {
            const extent = analysisView.extent;
            if(geometryEngine.intersects(extent, visibleAreasUnion)) {
              const clippedUnionArea = geometryEngine.clip(visibleAreasUnion, extent);
              const clippedUnionAreaSqFt = geometryEngine.geodesicArea(clippedUnionArea, "square-feet");
              const viewExtentAreaSqFt = geometryEngine.geodesicArea(extent, "square-feet");
              dom.byId("aoi-area").innerHTML = number.format(viewExtentAreaSqFt, { places: 0 });
              dom.byId("coverage-area-percent").innerHTML = `${number.format((clippedUnionAreaSqFt / viewExtentAreaSqFt) * 100, { places: 1 })} %`;
            } else {
              dom.byId("overlap-area").innerHTML = "0";
              dom.byId("coverage-area-percent").innerHTML = "0.0 %";
            }
          } else {
            const areaOfInterest = this.coverageOptions.areaOfInterest;
            if(geometryEngine.intersects(areaOfInterest, visibleAreasUnion)) {
              const intersectUnionArea = geometryEngine.intersect(visibleAreasUnion, areaOfInterest);
              const intersectUnionAreaSqFt = geometryEngine.geodesicArea(intersectUnionArea, "square-feet");
              const areaOfInterestAreaSqFt = geometryEngine.geodesicArea(areaOfInterest, "square-feet");
              dom.byId("aoi-area").innerHTML = number.format(areaOfInterestAreaSqFt, { places: 0 });
              dom.byId("coverage-area-percent").innerHTML = `${number.format((intersectUnionAreaSqFt / areaOfInterestAreaSqFt) * 100, { places: 1 })} %`;
            } else {
              dom.byId("overlap-area").innerHTML = "0";
              dom.byId("coverage-area-percent").innerHTML = "0.0 %";
            }
          }
        } else {
          dom.byId("overlap-area").innerHTML = "0";
          dom.byId("coverage-area-percent").innerHTML = "0.0 %";
        }
      };

      // COVERAGE OPTIONS //
      this.coverageOptions = null;

      this.on("coverage-update", (options) => {
        this.coverageOptions = { ...this.coverageOptions, ...options };
        if(this.extentHandle) {
          this.extentHandle.remove();
        }
        if(this.coverageOptions.type === "current-map-extent") {
          this.extentHandle = analysisView.watch("extent", this.updateCoverage);
        }
        this.updateCoverage();
      });
      this.emit("coverage-update", { type: "current-map-extent", areaOfInterest: null });


      return visibilityLayer;
    },


    /**
     *
     * @param analysisView
     */
    initializeCoverageUtils: function (analysisView) {


    },

    /**
     *
     * @param analysisView
     * @param featureLayer
     * @param gradientStops
     */
    applyGradientFill: function (analysisView, featureLayer, gradientStops) {

      analysisView.whenLayerView(featureLayer).then((featureLayerView) => {
        watchUtils.whenDefined(featureLayerView, "featuresView", () => {

          const gfxView = featureLayerView.featuresView;
          const originalAdd = gfxView._add.bind(gfxView);
          const originalRemove = gfxView._remove.bind(gfxView);

          const handles = new Map();
          const gradients = new Map();

          gfxView._add = function (graphic) {
            originalAdd(graphic);
            const gfxObject = this._frontObjects.get(graphic);
            handles.set(gfxObject, gfxObject.on("post-render", function () {
              if(gfxObject._shape) {
                const path = gfxObject._shape.rawNode;
                const svg = gfxView.container.surface.rawNode;
                const gradientId = "grad-" + graphic.uid;
                if(!gradients.has(gfxObject)) {
                  const centerOffsets = graphic.getAttribute("centerOffsets");
                  gradients.set(gfxObject, createGradient(svg, gradientId, gradientStops, centerOffsets));
                }
                path.setAttribute("fill", "url(#" + gradientId + ")");
              }
            }));
          };

          gfxView._remove = function (graphic) {
            const gfxObject = this._frontObjects.get(graphic);
            const gradient = gradients.get(gfxObject);
            handles.delete(gfxObject);
            gradients.delete(gfxObject);
            if(gradient) {
              gradient.parentNode.removeChild(gradient);
            }
            originalRemove(graphic);
          }

        });
      });

      // https://stackoverflow.com/questions/10894377/dynamically-adding-a-svg-gradient
      function createGradient(svg, id, stops, centerOffsets) {
        const svgNS = svg.namespaceURI;
        const grad = document.createElementNS(svgNS, "radialGradient");
        grad.setAttribute("id", id);

        if(centerOffsets != null) {
          centerOffsets = JSON.parse(centerOffsets);
          if((centerOffsets.cx != null) && (centerOffsets.cy != null)) {
            grad.setAttribute("cx", `${centerOffsets.cx}%`);
            grad.setAttribute("cy", `${centerOffsets.cy}%`);
          }
        }

        for (let stopIndex = 0; stopIndex < stops.length; stopIndex++) {
          const attrs = stops[stopIndex];
          const stop = document.createElementNS(svgNS, "stop");
          for (const attr in attrs) {
            if(attrs.hasOwnProperty(attr)) stop.setAttribute(attr, attrs[attr]);
          }
          grad.appendChild(stop);
        }
        const defs = svg.querySelector('defs') || svg.insertBefore(document.createElementNS(svgNS, "defs"), svg.firstChild);
        return defs.appendChild(grad);
      }

    },

    /**
     *
     * @param analysisView
     */
    initializeAnalysisViewTools: function (analysisView) {

      // ADD BLUE LIGHTS TOGGLE BUTTON //
      let addBlueLightEnabled = false;
      const addBlueLightBtn = dom.byId("add-blue-light-btn");
      on(addBlueLightBtn, "click", () => {
        domClass.toggle(addBlueLightBtn, "icon-ui-check-mark");
        addBlueLightEnabled = domClass.contains(addBlueLightBtn, "icon-ui-check-mark");
        analysisView.container.style.cursor = addBlueLightEnabled ? "crosshair" : "default";
        //domClass.toggle(analysisView.container, "crosshair default", addBlueLightEnabled);
      });


      const setViewCursor = (cursor) => {
        //domClass.toggle(analysisView.container, "move crosshair default", addBlueLightEnabled);
        analysisView.container.style.cursor = cursor || (addBlueLightEnabled ? "crosshair" : "default");
      };

      analysisView.on("pointer-move", (pointerMoveEvt) => {
        if(addBlueLightEnabled) {
          analysisView.hitTest(pointerMoveEvt).then((response) => {
            const blueLightResults = response.results.find((result) => {
              return (result.graphic && result.graphic.layer && (result.graphic.layer.title === "Blue Light Locations"));
            });
            setViewCursor(blueLightResults ? "move" : null);
          });
        } else {
          setViewCursor();
        }
      });


      // ADD BLUE LIGHT VIEW EVENTS //
      analysisView.on("pointer-down", (pointerDownEvt) => {
        if(addBlueLightEnabled) {
          setViewCursor("move");
          analysisView.hitTest(pointerDownEvt).then((response) => {
            const blueLightResults = response.results.find((result) => {
              return (result.graphic.layer && result.graphic.layer.title === "Blue Light Locations");
            });
            if(blueLightResults) {
              this.blueLight = blueLightResults.graphic;
            } else {
              const location = analysisView.toMap({ x: pointerDownEvt.x, y: pointerDownEvt.y });
              this.blueLight = this.addBlueLightLocation(location);
            }
          });
        }
      });

      analysisView.on("drag", (dragEvt) => {
        if(addBlueLightEnabled) {
          dragEvt.stopPropagation();
          setViewCursor("move");
          if(dragEvt.action === "update") {
            if(this.blueLight) {
              const location = analysisView.toMap({ x: dragEvt.x, y: dragEvt.y });
              this.blueLight = this.updateBlueLightLocation(this.blueLight, location);
              this.updateBlueLightsAnalysis(this.ANALYSIS_RESOLUTION.FAST);
            }
          }
        }
      });
      analysisView.on("pointer-up", (pointerUpEvt) => {
        if(addBlueLightEnabled) {
          setViewCursor("move");
          this.blueLight = null;
          this.updateBlueLightsAnalysis();
        }
      });

      // ANALYSIS DISTANCE //
      on(dom.byId("analysis-distance-input"), "input", () => {
        dom.byId("analysis-distance-label").innerHTML = dom.byId("analysis-distance-input").value;
      });
      on(dom.byId("analysis-distance-input"), "change", () => {
        this.clearVisibleAreaCaches();
        this.updateBlueLightsAnalysis();
      });

      // CLEAR ANALYSIS //
      this.clearBlueLightsAnalysis = () => {
        this.clearBlueLightsLayer();
        this.updateBlueLightsAnalysis();
      };
      on(dom.byId("clear-analysis-btn"), "click", this.clearBlueLightsAnalysis);

      // SAVE ANALYSIS //
      let blueLightsCSVFileUrl = null;
      on(dom.byId("save-csv-btn"), "click", () => {
        query(".csv_export_link").orphan();

        if(blueLightsCSVFileUrl !== null) {
          URL.revokeObjectURL(blueLightsCSVFileUrl);
        }
        const blueLightsCSVContent = this.getBlueLightsAsCSVItems();
        const blueLightsCSVBlob = new Blob([blueLightsCSVContent], { type: 'text/plain' });
        blueLightsCSVFileUrl = URL.createObjectURL(blueLightsCSVBlob);

        domConstruct.create("a", {
          className: "csv_export_link icon-ui-download text-center font-size--3",
          title: "Download Blue Light locations CSV file...",
          target: "_blank",
          download: "BlueLightLocations.csv",
          innerHTML: "Blue Light Locations",
          href: blueLightsCSVFileUrl
        }, "save-csv-node", "only");

      });

    },

    /**
     *
     * @param analysisLocation
     * @param analysisDistanceMeters
     * @param numberOfPoints
     */
    calculateVisibleArea: function (analysisLocation, analysisDistanceMeters, numberOfPoints) {

      const searchArea = new Circle({
        spatialReference: analysisLocation.spatialReference,
        geodesic: true,
        center: analysisLocation,
        radius: analysisDistanceMeters,
        radiusUnit: "meters",
        numberOfPoints: numberOfPoints || 360
      });

      const isValidIntersection = (intersection) => {
        return (intersection != null);
      };


      /*const sightLineIntersection = (coords, coordIndex) => {
        const deferred = new Deferred();

        // SIGHTLINE //
        const sightline = new Polyline({
          spatialReference: analysisLocation.spatialReference,
          paths: [[[analysisLocation.x, analysisLocation.y], [coords[0], coords[1]]]]
        });

        // CALC INTERSECTING LOCATIONS BETWEEN SIGHTLINE WITH OBSTRUCTIONS //
        const sightlineIntersections = geometryEngine.intersect(intersectingObstructions, sightline);
        const validSightlineIntersections = sightlineIntersections.filter(isValidIntersection);

        // FIND NEAREST INTERSECTION TO ANALYSIS LOCATION //
        let nearestIntersection = null;
        if(validSightlineIntersections.length > 0) {
          const allSightlineIntersections = geometryEngine.union(validSightlineIntersections);

          if(this.debug) {
            allSightlineIntersections.paths[0].forEach((pntCoords, pntCoordIndex) => {
              this.addIntersection(allSightlineIntersections.getPoint(0, pntCoordIndex));
            });
          }

          nearestIntersection = geometryEngine.nearestVertex(allSightlineIntersections, analysisLocation).coordinate;
        } else {
          nearestIntersection = searchArea.getPoint(0, coordIndex);
        }

        // ADD NEAREST INTERSECTION //
        deferred.resolve([nearestIntersection.x, nearestIntersection.y]);

        return deferred.promise;
      };*/


      // FIND INTERSECTING OBSTRUCTIONS //
      const searchAreaObstructions = geometryEngine.intersect(this.obstructions, searchArea);
      const intersectingObstructions = searchAreaObstructions.filter(isValidIntersection);

      // CREATE SIGHTLINES //
      const sightlineFootprintIntersections = searchArea.rings[0].map((coords, coordIndex) => {
        //return sightLineIntersection(coords, coordIndex)

        // SIGHTLINE //
        const sightline = new Polyline({
          spatialReference: analysisLocation.spatialReference,
          paths: [[[analysisLocation.x, analysisLocation.y], [coords[0], coords[1]]]]
        });
        if(this.debug) {
          this.addSightline(sightline);
        }

        // CALC INTERSECTING LOCATIONS BETWEEN SIGHTLINE WITH OBSTRUCTIONS //
        const sightlineIntersections = geometryEngine.intersect(intersectingObstructions, sightline);
        const validSightlineIntersections = sightlineIntersections.filter(isValidIntersection);

        // FIND NEAREST INTERSECTION TO ANALYSIS LOCATION //
        let nearestIntersection = null;
        if(validSightlineIntersections.length > 0) {
          const allSightlineIntersections = geometryEngine.union(validSightlineIntersections);

          if(this.debug) {
            allSightlineIntersections.paths[0].forEach((pntCoords, pntCoordIndex) => {
              this.addIntersection(allSightlineIntersections.getPoint(0, pntCoordIndex));
            });
          }

          nearestIntersection = geometryEngine.nearestVertex(allSightlineIntersections, analysisLocation).coordinate;
        } else {
          nearestIntersection = searchArea.getPoint(0, coordIndex);
        }

        if(this.debug) {
          this.addIntersection(nearestIntersection, true);
        }

        // ADD NEAREST INTERSECTION //
        return [nearestIntersection.x, nearestIntersection.y];
      });

      /*return promiseUtils.eachAlways(sightlineFootprintIntersections).then((results) => {

        const allResults = results.reduce((infos, result) => {
          return infos.concat(result.value);
        }, []);

        // VISIBLE AREA //
        const visibleArea = new Polygon({
          spatialReference: analysisLocation.spatialReference,
          rings: [allResults]
        });

        // CENTER OFFSETS //
        // https://developer.mozilla.org/en-US/docs/Web/SVG/Element/radialGradient
        const centerOffsets = {
          cx: 50.0 - (((visibleArea.extent.center.x - searchArea.extent.center.x) / visibleArea.extent.width) * 100),
          cy: 50.0 + (((visibleArea.extent.center.y - searchArea.extent.center.y) / visibleArea.extent.height) * 100),
        };

        return { visibleArea: visibleArea, centerOffsets: centerOffsets };
      });*/

      // VISIBLE AREA //
      const visibleArea = new Polygon({
        spatialReference: analysisLocation.spatialReference,
        rings: [sightlineFootprintIntersections]
      });

      // CENTER OFFSETS //
      // https://developer.mozilla.org/en-US/docs/Web/SVG/Element/radialGradient
      const centerOffsets = {
        cx: 50.0 - (((visibleArea.extent.center.x - searchArea.extent.center.x) / visibleArea.extent.width) * 100),
        cy: 50.0 + (((visibleArea.extent.center.y - searchArea.extent.center.y) / visibleArea.extent.height) * 100),
      };

      return { visibleArea: visibleArea, centerOffsets: centerOffsets };
    },

    /**
     *
     * @param searchAreaObstructions
     * @param analysisLocation
     * @param analysisDistanceMeters
     * @param numberOfPoints
     * @returns {Promise}
     */
    calculateVisibleAreaAsync: function (searchAreaObstructions, analysisLocation, analysisDistanceMeters, numberOfPoints) {

      const searchArea = new Circle({
        spatialReference: analysisLocation.spatialReference,
        geodesic: true,
        center: analysisLocation,
        radius: analysisDistanceMeters,
        radiusUnit: "meters",
        numberOfPoints: numberOfPoints || 360
      });

      // FIND INTERSECTING OBSTRUCTIONS //
      return this.findObstructionLocations(searchAreaObstructions, searchArea).then((intersectingObstructions) => {

        // CREATE SIGHTLINES //
        const sightlineFootprintIntersections = searchArea.rings[0].map((coords, coordIndex) => {

          // SIGHTLINE //
          const sightline = new Polyline({
            spatialReference: analysisLocation.spatialReference,
            paths: [[[analysisLocation.x, analysisLocation.y], [coords[0], coords[1]]]]
          });
          if(this.debug) {
            this.addSightline(sightline);
          }

          // CALC INTERSECTING LOCATIONS BETWEEN SIGHTLINE WITH OBSTRUCTIONS //
          return this.findObstructionLocations(intersectingObstructions, sightline).then((validSightlineIntersections) => {

            // FIND NEAREST INTERSECTION TO ANALYSIS LOCATION //
            let nearestIntersection = null;
            if(validSightlineIntersections.length > 0) {
              const allSightlineIntersections = geometryEngine.union(validSightlineIntersections);

              if(this.debug) {
                allSightlineIntersections.paths[0].forEach((pntCoords, pntCoordIndex) => {
                  this.addIntersection(allSightlineIntersections.getPoint(0, pntCoordIndex));
                });
              }

              nearestIntersection = geometryEngine.nearestVertex(allSightlineIntersections, analysisLocation).coordinate;
            } else {
              nearestIntersection = searchArea.getPoint(0, coordIndex);
            }

            if(this.debug) {
              this.addIntersection(nearestIntersection, true);
            }

            // ADD NEAREST INTERSECTION //
            return [nearestIntersection.x, nearestIntersection.y];
          });
        });


        return promiseUtils.eachAlways(sightlineFootprintIntersections).then((results) => {

          const allResults = results.map((result) => {
            return result.value;
          });

          // VISIBLE AREA //
          const visibleArea = new Polygon({
            spatialReference: analysisLocation.spatialReference,
            rings: [allResults]
          });

          // CENTER OFFSETS //
          // https://developer.mozilla.org/en-US/docs/Web/SVG/Element/radialGradient
          const centerOffsets = {
            cx: 50.0 - (((visibleArea.extent.center.x - searchArea.extent.center.x) / visibleArea.extent.width) * 100),
            cy: 50.0 + (((visibleArea.extent.center.y - searchArea.extent.center.y) / visibleArea.extent.height) * 100),
          };

          return { visibleArea: visibleArea, centerOffsets: centerOffsets };
        });
      });

    },

    /**
     *
     * @param analysisView
     * @param layersParent
     */
    initializeObstructionSources: function (analysisView, layersParent) {

      // OBSTRUCTIONS BY LAYER //
      this.obstructionsByLayer = {};

      // OBSTRUCTIONS LAYER //
      const obstructionsLayer = new FeatureLayer({
        title: "Obstructions",
        objectIdField: "OBJECTID",
        geometryType: "polygon",
        spatialReference: analysisView.spatialReference,
        fields: [
          {
            name: "OBJECTID",
            alias: "OBJECTID",
            type: "oid"
          },
          {
            name: "source",
            alias: "source",
            type: "string"
          }
        ],
        source: [],
        popupEnabled: false,
        opacity: 0.8,
        renderer: new SimpleRenderer({
          symbol: new SimpleFillSymbol({
            color: "#444",
            style: "solid",
            outline: {
              color: "#ccc",
              width: 1.5
            }
          })
        })
      });

      // SET OBSTRUCTIONS //
      this.setObstructions = (obstructionAnalysisResults) => {
        // CLEAR PREVIOUS OBSTRUCTION FEATURES //
        obstructionsLayer.source.removeAll();
        // ADD OBSTRUCTIONS FEATURES //
        obstructionAnalysisResults.forEach((obstructionResult) => {
          obstructionsLayer.source.addMany(obstructionResult.value);
        });
        dom.byId("building-count").innerHTML = number.format(obstructionsLayer.source.length);

        // OBSTRUCTIONS //
        this.obstructions = obstructionsLayer.source.reduce((obstructions, obstructionFeature) => {
          return obstructions.concat(obstructionFeature.geometry);
        }, []);

        this.findObstructionLocations = (obstructions, searchArea) => {
          return geometryEngineAsync.intersect(obstructions, searchArea).then((searchAreaObstructions) => {
            return searchAreaObstructions.filter((searchAreaObstruction) => {
              return (searchAreaObstruction != null);
            });
          });
        };

      };

      // HAS OBSTRUCTIONS //
      this.hasObstructions = () => {
        return (obstructionsLayer.source.length > 0);
      };

      // CREATE LIST OF SOURCE OBSTRUCTION LAYERS //
      layersParent.layers.filter(function (layer) {
        return ((layer.type === "feature") && (layer.geometryType === "polygon"));
      }).forEach(function (featureLayer) {
        const isCandidate = /building|footprint|obstruction|tree/ig.test(featureLayer.title);

        domConstruct.create("input", {
          className: "obstruction-layer-input",
          type: "checkbox",
          checked: isCandidate,
          value: featureLayer.id
        }, domConstruct.create("label", {
          innerHTML: featureLayer.title
        }, "obstructions-list"));

      }.bind(this));

      // UPDATE VISIBILITY OBSTRUCTIONS //
      const updateVisibilityObstructions = () => {
        const obstructionLayers = query(".obstruction-layer-input:checked").reduce((layers, input) => {
          return layers.concat(layersParent.findLayerById(input.value));
        }, []);
        domClass.toggle("no-obstructions-error", "hide", (obstructionLayers.length > 0));
        domClass.toggle("add-blue-light-btn", "btn-disabled", (obstructionLayers.length === 0));

        this.setVisibilityObstructions(obstructionLayers, analysisView.spatialReference).then(() => {
          this.clearVisibleAreaCaches();
          this.updateBlueLightsAnalysis();
        });
      };
      query(".obstruction-layer-input").on("change", updateVisibilityObstructions);
      updateVisibilityObstructions();

      return obstructionsLayer;
    },

    /**
     *
     * @param obstructionLayers
     * @param outSpatialReference
     */
    setVisibilityObstructions: function (obstructionLayers, outSpatialReference) {

      const getObstructionsHandles = obstructionLayers.map((obstructionLayer) => {
        if(obstructionLayer.title in this.obstructionsByLayer) {
          return promiseUtils.resolve(this.obstructionsByLayer[obstructionLayer.title]);
        } else {
          return this.getSourceObstructions(obstructionLayer, outSpatialReference).then((obstructionFeatures) => {
            return this.obstructionsByLayer[obstructionLayer.title] = obstructionFeatures;
          });
        }
      });

      return promiseUtils.eachAlways(getObstructionsHandles).then(this.setObstructions);
    },

    /**
     *
     * @param obstructionLayer
     * @param outSpatialReference
     * @returns {Promise}
     */
    getSourceObstructions: function (obstructionLayer, outSpatialReference) {

      const allObstructionsQuery = obstructionLayer.createQuery();
      allObstructionsQuery.outSpatialReference = outSpatialReference;
      allObstructionsQuery.where = "1=1";
      return obstructionLayer.queryFeatures(allObstructionsQuery).then((obstructionsFeatureSet) => {
        return obstructionsFeatureSet.features.map((feature) => {
          return new Graphic({
            geometry: feature.geometry.clone(),
            attributes: { source: obstructionLayer.title }
          });
        });
      });

    }

  });
});


/*initializeBlueLightAnalysisService: function (view) {

 this.useService = false;
 const resultsSettingsNode = domConstruct.create("div", { id: "results-settings-node", className: "esri-widget esri-widget-button esri-icon-settings2", title: "Use GP Service" });
 view.ui.add(resultsSettingsNode, "bottom-right");
 on(resultsSettingsNode, "click", () => {
 this.useService = (!this.useService);
 domClass.toggle(resultsSettingsNode, "use-service", this.useService);
 this.toggleVisibilityLayer(!this.useService);
 this.updateBlueLightsAnalysis();
 });


 //const blueLightGPServiceUrl = "https://maps.esri.com/apl1/rest/services/BlueLightAnalysis/GPServer/Blue%20Light%20Analysis";
 const blueLightGPServiceUrl = "https://maps.esri.com/apl22/rest/services/BlueLightAnalysis2/GPServer/Blue%20Light%20Analysis";
 const blueLightGPService = new Geoprocessor({
 url: blueLightGPServiceUrl,
 outSpatialReference: view.spatialReference
 });

 this.updateBlueLightsAnalysisService = () => {

 const analysisDistanceMeters = dom.byId("analysis-distance-input").valueAsNumber;

 const analysisParams = {
 Input_Locations: new FeatureSet({
 features: this.getBlueLightFeatures()
 }),
 Analysis_Distance: analysisDistanceMeters,
 Input_Obstructions: new FeatureSet({
 features: this.getObstructionFeatures()
 })
 };

 blueLightGPService.submitJob(analysisParams).then((submitResponse) => {
 if(submitResponse.jobStatus === "job-succeeded") {

 const mapImageLayer = blueLightGPService.getResultMapImageLayer(submitResponse.jobId);
 mapImageLayer.load().then(() => {

 mapImageLayer.title = "Distance to Blue Lights";
 view.map.add(mapImageLayer);

 }).otherwise(console.warn);
 } else {
 console.warn("Submit Response: ", submitResponse);
 }
 }).otherwise(console.warn);

 }

 },*/

/*domConstruct.create("div", {
 id: "toggle-day-basemap",
 title: "Day Basemap",
 className: "toggle-basemap toggle-basemap-day esri-icon-maps esri-widget esri-widget-button left"
 }, basemapsNode);

 domConstruct.create("div", {
 id: "toggle-evening-basemap",
 title: "Evening Basemap",
 className: "toggle-basemap toggle-basemap-evening esri-icon-maps esri-widget esri-widget-button left"
 }, basemapsNode);

 domConstruct.create("div", {
 id: "toggle-night-basemap",
 title: "Night Basemap",
 className: "toggle-basemap toggle-basemap-night esri-icon-maps esri-widget esri-widget-button left"
 }, basemapsNode);*/

/*query(".toggle-basemap", basemapsNode).on("click", (evt) => {
 switch (evt.target.id) {
 case "toggle-day-basemap":
 adjustDefaultBasemap(1.0);
 break;
 case "toggle-evening-basemap":
 adjustDefaultBasemap(0.6);
 break;
 case "toggle-night-basemap":
 adjustDefaultBasemap(0.0);
 break;
 }
 });*/


