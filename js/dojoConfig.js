/* global dojoConfig:true */
const package_path = window.location.pathname.substring(0, window.location.pathname.lastIndexOf("/"));
dojoConfig = {
  async: true,
  parseOnLoad: true,
  packages: [
    { name: "application", location: package_path + "/js/application", main: "app" },
    { name: "boilerplate", location: package_path + "/js/boilerplate", main: "Boilerplate" },
    { name: "config", location: package_path + "/config" },
    { name: "calcite", location: "//s3-us-west-1.amazonaws.com/patterns.esri.com/files/calcite-web/1.2.5/js", main: "calcite-web.min" }
  ]
};
if(location.search.match(/locale=([\w-]+)/)) {
  dojoConfig.locale = RegExp.$1;
}
