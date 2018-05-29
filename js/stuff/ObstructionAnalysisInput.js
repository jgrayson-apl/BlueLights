/**
 *
 * ObstructionAnalysisInput
 *  - Input to obstruction analysis
 *
 * Author:   John Grayson - Applications Prototype Lab - Esri
 * Created:  10/20/2017 - 0.0.1 -
 * Modified:
 *
 */
define([
  "esri/core/Accessor",
  "esri/core/Evented",
  "esri/core/Collection",
  "esri/geometry/Point",
  "esri/geometry/Polyline",
  "esri/geometry/Circle",
  "esri/geometry/Polygon",
  "esri/geometry/geometryEngine",
], function (Accessor, Evented, Collection, Point, Polyline, Circle, Polygon, geometryEngine) {

  // https://stackoverflow.com/questions/105034/create-guid-uuid-in-javascript
  // _uuidv4
  function _generateGUID() {
    return '{xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx}'.replace(/[xy]/g, function (c) {
      const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  const ObstructionAnalysisInput = Accessor.createSubclass([Evented], {

    properties: {
      id: {
        type: String,
        readOnly: true,
        value: _generateGUID()
      },
      obstructions: {
        type: Array,
        value: null,
        set: function (value) {

        }
      },
      center: {
        type: Point,
        value: null,
        set: function (value) {
          this._set("center", value);
          this.notifyChange("result");
        }
      },
      distance: {
        type: Number,
        value: 100,
        set: function (value) {
          this._set("distance", value);
          //this.notifyChange("result");
        }
      },
      numberOfPoints: {
        type: Number,
        dependsOn: ["intermediate"],
        value: 360,
        set: function (value) {
          this._set("numberOfPoints", value);
          //this.notifyChange("result");
        },
        get: function () {
          return this.intermediate ? 60 : 360;
        }
      },
      intermediate: {
        type: Boolean,
        value: false,
        set: function (value) {
          this._set("intermediate", value);
          this.notifyChange("numberOfPoints");
          //this.notifyChange("result");
        }
      },
      searchArea: {
        type: Circle,
        dependsOn: ["center", "distance", "numberOfPoints"],
        value: null,
        get: function () {
          return new Circle({
            center: this.center,
            spatialReference: this.center.spatialReference,
            radius: this.distance,
            radiusUnit: "meters",
            geodesic: true,
            numberOfPoints: this.numberOfPoints
          });
        }
      },
      result: {
        type: Polygon,
        dependsOn: ["searchArea"],
        value: null,
        get: function () {
          return this.getVisibleArea();
        }
      }
    },

    /**
     *
     * @param center
     * @param intermediate
     */
    update: function (center, intermediate) {
      this.center = center;
      this.intermediate = (intermediate != null) ? intermediate : false;
      return this.result;
    },

    /**
     *
     * @returns {*}
     */
    getVisibleArea: function () {

      const isValidIntersection = (intersection) => {
        return (intersection != null);
      };

      // FIND INTERSECTING OBSTRUCTIONS //
      const searchAreaObstructions = geometryEngine.intersect(this.obstructions, this.searchArea);
      const intersectingObstructions = searchAreaObstructions.filter(isValidIntersection);

      // CREATE SIGHTLINES //
      const sightlineFootprintIntersections = this.searchArea.rings[0].map((coords, coordIndex) => {

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
          nearestIntersection = this.searchArea.getPoint(0, coordIndex);
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

  ObstructionAnalysisInput.version = "0.0.1";

  return ObstructionAnalysisInput;
});