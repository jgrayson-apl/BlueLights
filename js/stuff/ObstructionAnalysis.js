/**
 *
 * ObstructionAnalysis
 *  - Analyze visibility using obstructions
 *
 * Author:   John Grayson - Applications Prototype Lab - Esri
 * Created:  9/29/2017 - 0.0.2 -
 * Modified:
 *
 */
define([
  "esri/core/Accessor",
  "dojo/Evented",
  "esri/core/Collection",
  "esri/geometry/Point",
  "esri/geometry/Polyline",
  "esri/geometry/Polygon",
  "esri/geometry/Circle",
  "esri/geometry/geometryEngine"
], function (Accessor, Evented, Collection,
             Point, Polyline, Polygon, Circle, geometryEngine) {

  // https://stackoverflow.com/questions/105034/create-guid-uuid-in-javascript
  // _uuidv4
  function _generateGUID() {
    return '{xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx}'.replace(/[xy]/g, function (c) {
      const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  const ObstructionAnalysis = Accessor.createSubclass([Evented], {

    declaredClass: "ObstructionAnalysis",

    properties: {
      id: {
        value: _generateGUID()
      },
      obstructions: {
        value: null
      },
      analysisLocation: {
        value: null
      },
      analysisDistanceMeters: {
        value: 100.0
      },
      intermediate: {
        value: false,
        set: function (value) {
          this._set("intermediate", value);
          this.notifyChange("numberOfPoints");
        }
      },
      numberOfPoints: {
        dependsOn: ["intermediate"],
        value: 360,
        get: function () {
          return this.intermediate ? 60 : 360;
        }
      },
      result: {
        readOnly: true,
        dependsOn: ["obstructions", "analysisLocation", "analysisDistanceMeters", "numberOfPoints"],
        value: null,
        get: function () {
          return this.getVisibleArea();
        }
      }
    },

    /**
     *
     * @param location
     * @param intermediate
     */
    update: function (location, intermediate) {
      this.analysisLocation = location;
      this.intermediate = (intermediate != null) ? intermediate : false;
      return this.result;
    },

    /**
     *
     * @returns {*}
     */
    getVisibleArea: function () {

      const searchArea = new Circle({
        spatialReference: this.analysisLocation.spatialReference,
        geodesic: true,
        center: this.analysisLocation,
        radius: this.analysisDistanceMeters,
        radiusUnit: "meters",
        numberOfPoints: this.numberOfPoints
      });

      const isValidIntersection = (intersection) => {
        return (intersection != null);
      };

      // FIND INTERSECTING OBSTRUCTIONS //
      const searchAreaObstructions = geometryEngine.intersect(this.obstructions, searchArea);
      const intersectingObstructions = searchAreaObstructions.filter(isValidIntersection);

      // CREATE SIGHTLINES //
      const sightlineFootprintIntersections = searchArea.rings[0].map((coords, coordIndex) => {

        // SIGHTLINE //
        const sightline = new Polyline({
          spatialReference: this.analysisLocation.spatialReference,
          paths: [[[this.analysisLocation.x, this.analysisLocation.y], [coords[0], coords[1]]]]
        });

        // CALC INTERSECTING LOCATIONS BETWEEN SIGHTLINE WITH OBSTRUCTIONS //
        const sightlineIntersections = geometryEngine.intersect(intersectingObstructions, sightline);
        const validSightlineIntersections = sightlineIntersections.filter(isValidIntersection);

        // FIND NEAREST INTERSECTION TO ANALYSIS LOCATION //
        let nearestIntersection = null;
        if(validSightlineIntersections.length > 0) {
          const allSightlineIntersections = geometryEngine.union(validSightlineIntersections);

          nearestIntersection = geometryEngine.nearestVertex(allSightlineIntersections, this.analysisLocation).coordinate;
        } else {
          nearestIntersection = searchArea.getPoint(0, coordIndex);
        }

        // ADD NEAREST INTERSECTION //
        return [nearestIntersection.x, nearestIntersection.y];
      });

      return new Polygon({
        spatialReference: this.analysisLocation.spatialReference,
        rings: [sightlineFootprintIntersections]
      });
    },

  });

  ObstructionAnalysis.version = "0.0.2";

  return ObstructionAnalysis;
});