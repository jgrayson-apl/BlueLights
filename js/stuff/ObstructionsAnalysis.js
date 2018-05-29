/**
 *
 * ObstructionsAnalysis
 *  - Analyze visibility using obstructions
 *
 * Author:   John Grayson - Applications Prototype Lab - Esri
 * Created:  9/29/2017 - 0.0.2 -
 * Modified:
 *
 */
define([
  "esri/core/Accessor",
  "esri/core/Evented",
  "esri/core/Collection",
  "./ObstructionAnalysisInput",
  "esri/geometry/Polygon"
], function (Accessor, Evented, Collection, ObstructionAnalysisInput, Polygon) {


  const ObstructionsAnalysis = Accessor.createSubclass([Evented], {

    declaredClass: "ObstructionsAnalysis",

    properties: {
      obstructions: {
        type: Collection.ofType(Polygon),
        value: null
      },
      analysisDistanceMeters: {
        value: 100.0
      },
      analysisItems: {
        dependsOn: ["obstructions", "analysisDistanceMeters"],
        value: new Map()
      },
      results: {
        dependsOn: ["obstructions", "analysisDistanceMeters"],
        readOnly: true,
        value: new Map()
      }
    },

    /**
     *
     * @param location
     * @returns {*}
     */
    addLocation: (location) => {
      //this.locations.add(location);

      const analysisItem = new ObstructionAnalysisInput({
        obstructions: this.obstructions,
        center: location,
        distance: this.analysisDistanceMeters
      });
      this.analysisItems.set(analysisItem.id, analysisItem);

      analysisItem.watch("result", (result) => {
        this.results.set(analysisItem.id, result);
      });

      return analysisItem.id;
    },

    /**
     *
     * @param id
     * @param location
     * @param intermediate
     */
    updateAnalysis: (id, location, intermediate) => {
      this.analysisItems.get(id).update(location, intermediate);
    },

    /**
     *
     */
    updateResults: () => {
      this.analysisItems.forEach((analysisItem, id) => {
        this.results.set(id, analysisItem.result);
      });
    }

  });

  ObstructionsAnalysis.version = "0.0.2";

  return ObstructionsAnalysis;
});