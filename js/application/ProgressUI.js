/**
 *
 * ProgressUI
 *  - A simple UI to provide progress status.
 *
 * Author:   John Grayson - Applications Prototype Lab - Esri
 * Created:  12/19/2017 - 0.0.1 -
 * Modified:
 *
 */
define([
  "esri/core/Accessor",
  "esri/core/Evented",
  "esri/views/View",
  "dojo/dom-class",
  "dojo/dom-construct"
], function (Accessor, Evented, View, domClass, domConstruct) {

  const ProgressUI = Accessor.createSubclass([Evented], {
    declaredClass: "ProgressUI",

    _titleNode: null,
    _progressNode: null,
    _labelNode: null,

    properties: {
      view: {
        type: View,
        value: null
      },
      node: {
        type: Element,
        value: null,
        dependsOn: ["view"],
        get: function () {

          // PANEL //
          const progressPanel = domConstruct.create("div", { className: "panel esri-widget" });
          this.view.ui.add(progressPanel, "bottom-right");

          // TITLE //
          this._titleNode = domConstruct.create("div", { className: "text-center text-blue" }, progressPanel);

          // PROGRESS //
          this._progressNode = domConstruct.create("progress", { max: 100, value: 0, style: "width:100%;" }, progressPanel);

          // LABEL //
          this._labelNode = domConstruct.create("div", { className: "text-center avenir-italic font-size--3" }, progressPanel);

          return progressPanel;
        }
      },
      max: {
        type: Number,
        value: null,
        dependsOn: ["node"],
        set: function (value) {
          this._set("max", value);
          this._progressNode.max = this.max;
        }
      },
      value: {
        type: Number,
        value: null,
        dependsOn: ["node"],
        set: function (value) {
          this._set("value", value);
          this._progressNode.value = this.value;
        }
      },
      title: {
        type: String,
        value: "Progress Status",
        dependsOn: ["node"],
        set: function (value) {
          this._set("title", value);
          this._titleNode.innerHTML = value || "";
        }
      },
      label: {
        type: String,
        value: "",
        dependsOn: ["node"],
        set: function (value) {
          this._set("label", value);
          this._labelNode.innerHTML = value || "";
        }
      },
      visible: {
        type: Boolean,
        value: false,
        dependsOn: ["node"],
        set: function (value) {
          this._set("visible", value);
          domClass.toggle(this.node, "hide", !value)
        }
      }
    }
  });

  ProgressUI.version = "0.0.1";

  return ProgressUI;
});