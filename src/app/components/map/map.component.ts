
import { Component, OnInit, AfterViewInit, OnDestroy } from '@angular/core';

import * as L from 'leaflet';

import 'leaflet.markercluster';

import 'leaflet.fullscreen';

import * as Search from 'leaflet-search';

import { HTTPService } from '../../services/http.service';

import { ConfigService } from '../../services/config.service';

import { SidebarService } from 'src/app/services/sidebar.service';

import { MapService } from 'src/app/services/map.service';

import { LayerType } from 'src/app/enum/layer-type.enum';

import { Layer } from 'src/app/models/layer.model';

import { LayerGroup } from 'src/app/models/layer-group.model';

import { FilterService } from '../../services/filter.service';

import { LinkPopupService } from 'src/app/services/link-popup.service';

import { MapState } from 'src/app/models/map-state.model';

import { LayerInfo } from 'src/app/models/layer-info.model';

import { LayerInfoFeature } from 'src/app/models/layer-info-feature.model';

import { SelectedMarker } from 'src/app/models/selected-marker.model';

import { TableService } from 'src/app/services/table.service';

import {View} from '../../models/view.model';

@Component({
  selector: 'app-map',
  templateUrl: './map.component.html',
  styleUrls: ['./map.component.css']
})

export class MapComponent implements OnInit, AfterViewInit, OnDestroy {

  private map: L.Map;

  selectedLayers: Layer[] = [];

  private mapConfig;

  private layerControl: L.Control.Layers;
  private searchControl;

  markerClusterGroup: L.MarkerClusterGroup;

  selectedPrimaryLayer: Layer;

  markerInfo: L.Marker;

  selectedMarker: SelectedMarker;

  tableSelectedLayer: L.TileLayer.WMS;

  displayTable = false;
  displayLegend = false;
  displayInfo = false;
  displayVisibleLayers = false;

  tableReportActive = false;

  sidebarTableHeight = '48vh';

  tableHeight = '30vh';

  tableFullscreen = false;

  constructor(
    private hTTPService: HTTPService,
    private configService: ConfigService,
    private sidebarService: SidebarService,
    private tableService: TableService,
    private mapService: MapService,
    private filterService: FilterService,
    private linkPopupService: LinkPopupService
  ) { }

  ngOnInit() {
    this.mapConfig = this.configService.getMapConfig();

    this.sidebarService.sidebarLayerShowHide.next(true);
  }

  ngOnDestroy() {
    this.setLocalStorageData();
  }

  ngAfterViewInit() {
    this.setMap();
    this.setControls();
    this.setBaseLayers();
    this.setOverlayEvents();
    this.getLocalStorageData();
  }

  setMap() {
    this.map = L.map('map', {maxZoom: this.mapConfig.maxZoom});
    L.Handler.toString();
    this.panMap(this.mapConfig.initialLatLong, this.mapConfig.initialZoom);
    L.Marker.prototype.options.icon = L.icon({
      iconRetinaUrl: 'assets/marker-icon-2x.png',
      iconUrl: 'assets/marker-icon.png',
      shadowUrl: 'assets/marker-shadow.png',
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      tooltipAnchor: [16, -28],
      shadowSize: [41, 41]
    });
  }

  setControls() {
    this.setLayerControl();
    this.setFullScreenControl();
    this.setScaleControl();
    this.setLegendControl();
    this.setTableControl();
    this.setSearchControl();
    this.setInfoControl();
    this.setRestoreMapControl();
    this.setVisibleLayersControl();
    this.setMarkersGroup();
  }

  getLocalStorageData() {
    if (localStorage.getItem('mapState')) {
      const mapState: MapState = JSON.parse(localStorage.getItem('mapState'));
      // const reportTableOpened = mapState.reportTableOpened;
      const previousSelectedLayers: Layer[] = mapState.selectedLayers;
      const previousLatLong = mapState.mapLatLong;
      const previousZoom = mapState.mapZoom;
      this.selectedMarker = mapState.selectedMaker;

      if (previousSelectedLayers && previousSelectedLayers.length > 0) {
        previousSelectedLayers.forEach((layer: Layer) => {
          this.addLayer(layer, true);
          if (layer.markerSelected) {
            this.selectedPrimaryLayer = layer;
            this.updateMarkers(layer);
          }
        });
      } else {
        if (this.selectedMarker) {
          const marker = this.createMarker(this.selectedMarker.title,
            this.selectedMarker.content,
            this.selectedMarker.latLong,
            this.selectedMarker.overlayName,
            this.selectedMarker.link
          );
          this.markerClusterGroup.addLayer(marker);
          this.markerClusterGroup.addTo(this.map);
          marker.fire('click');
          // this.tableReportActive = reportTableOpened;
        }
      }
      this.panMap(previousLatLong, previousZoom);
    }
    localStorage.removeItem('mapState');
  }

  setLocalStorageData() {
    if (this.selectedLayers) {
      const mapState = new MapState(
        this.selectedLayers,
        this.selectedMarker,
        this.map.getZoom(),
        [
          this.map.getCenter().lat,
          this.map.getCenter().lng
        ],
        this.tableReportActive
      );
      localStorage.setItem('mapState', JSON.stringify(mapState));
    }
  }

  setBaseLayers() {
    this.mapConfig.baselayers.forEach(baseLayerData => {
      const baseLayer = this.getLayer(baseLayerData);
      const baseLayerName = baseLayerData.name;
      this.layerControl.addBaseLayer(baseLayer, baseLayerName);
      if (baseLayerData.default) {
        baseLayer.addTo(this.map);
      }
    });
  }

  setMarkers(data, popupTitle, overlayName) {
    this.clearMarkerInfo();
    this.layerControl.removeLayer(this.markerClusterGroup);
    data.forEach(markerData => {
      let popup = '';
      let link = null;
      if (popupTitle && markerData[popupTitle]) {
        popup = markerData[popupTitle];
        popup = popup.replace('/', '\\');
        link = `/report/${popup}`;
      } else {
        popup = popupTitle;
      }

      const popupContent = this.getPopupContent(markerData, overlayName);
      const marker = this.createMarker(popup, popupContent, [markerData.lat, markerData.long], overlayName, link);

      if (marker) {
        this.markerClusterGroup.addLayer(marker);
      }
    });
    this.searchControl.setLayer(this.markerClusterGroup);
    this.searchControl.options.layer = this.markerClusterGroup;

    if (this.selectedMarker) {
      const markerLatLong = new L.LatLng(this.selectedMarker.latLong[0], this.selectedMarker.latLong[1]);
      this.markerClusterGroup.eachLayer((marker: L.Marker) => {
        if (marker.getLatLng().equals(markerLatLong)) {
          this.panMap(markerLatLong, 18);
          marker.fire('click');
          this.selectedMarker = null;
        }
      });
    }
  }

  createMarker(popupTitle, popupContent, latLong, overlayName, link = '') {
    if (!popupContent) {
      return null;
    }
    const marker = L.marker(latLong, {title: popupTitle});
    marker.bindPopup(popupContent, {maxWidth: 500, maxHeight: 500});
    if (link) {
      this.linkPopupService.register(marker, link, 'Relatório');
      marker.on('popupopen', () =>
                this.selectedMarker = new SelectedMarker(overlayName, popupTitle, popupContent, latLong, link));
    }
    return marker;
  }

  setMarkersGroup() {
    this.markerClusterGroup = L.markerClusterGroup({chunkedLoading: true, spiderfyOnMaxZoom: true});
    this.map.addLayer(this.markerClusterGroup);
  }

  clearMap() {
    this.clearLayers();
    this.markerClusterGroup.clearLayers();
    this.selectedLayers = [];
  }

  setTableMarker(markerData) {
    let propertyData = markerData.data;
    if (!Array.isArray(propertyData)) {
      propertyData = [propertyData];
    }

    const propertyCount = propertyData.length;

    let latLong = null;

    propertyData.forEach(data => {
      latLong = [data.lat, data.long];

      let link = null;

      let carRegister = '';

      let markerLabel = '';

      if (this.tableReportActive) {
        markerLabel = 'CAR Validado';
        carRegister = data.registro_estadual;

        const layerData = {
                            url: 'http://www.terrama2.dpi.inpe.br/mpmt/geoserver/wms',
                            layers: 'terrama2_5:view5',
                            transparent: true,
                            format: 'image/png',
                            version: '1.1.0',
                            cql_filter: `numero_do1 = '${carRegister}'`
                          };
        const newLayer = this.getLayer(layerData);

        newLayer.addTo(this.map);

        this.tableSelectedLayer = newLayer;
      } else {
        const layer: Layer = markerData.layer;
        markerLabel = layer.label;
        const newLayer = JSON.parse(JSON.stringify(layer));

        this.tableSelectedLayer = this.addLayer(newLayer, false);

        const carRegisterKey = Object.keys(data).find(key => key.includes(layer.carRegisterColumn));
        carRegister = data[carRegisterKey];
      }

      if (carRegister) {
        carRegister = carRegister.replace('/', '\\');
        link = `/report/${carRegister}`;
      }

      if (propertyCount === 1) {
        this.clearMarkerInfo();
      }

      const popupContent = this.getPopupContent(data, markerLabel);
      this.markerInfo = this.createMarker(carRegister, popupContent, latLong, markerLabel, link );

      this.markerClusterGroup.addLayer(this.markerInfo);

      this.selectedMarker = new SelectedMarker(markerLabel, carRegister, popupContent, latLong, link);
    });
    this.markerClusterGroup.addTo(this.map);
    if (propertyCount === 1) {
      this.panMap(latLong, 13);
      this.markerInfo.fire('click');
    }
    this.searchControl.setLayer(this.markerClusterGroup);
    this.searchControl.options.layer = this.markerClusterGroup;
  }

  setOverlayEvents() {
    this.mapService.showMarker.subscribe(markerData => {
      if (this.tableSelectedLayer) {
        this.clearLayers();
        this.tableSelectedLayer = null;
        this.markerClusterGroup.clearLayers();
      }

      this.tableHeight = '10vh';
      this.sidebarTableHeight = '28vh';

      this.setTableMarker(markerData);
    });

    this.mapService.reportTable.subscribe(() => {
      this.displayTable = true;
      this.tableReportActive = true;
    });

    this.mapService.clearMap.subscribe(() => this.clearMap());

    this.filterService.filterMap.subscribe(() => {
      this.clearLayers();
      this.updateLayers();
    });

    this.sidebarService.sidebarLayerSelect.subscribe((itemSelected: Layer) => {
      this.clearMarkerInfo();
      this.clearReportTable();
      this.addLayer(itemSelected, true);
    });

    this.sidebarService.sidebarLayerDeselect.subscribe((itemDeselected: Layer) => {
      this.clearMarkerInfo();
      this.clearReportTable();
      if (this.selectedPrimaryLayer && this.selectedPrimaryLayer.value === itemDeselected.value) {
        this.markerClusterGroup.clearLayers();
      }
      this.removeLayer(itemDeselected, true);
    });

    this.sidebarService.sidebarLayerGroupSelect.subscribe((itemSelected: LayerGroup) => {
      this.clearMarkerInfo();
      this.clearReportTable();
      const layers = itemSelected.children;
      layers.forEach((layer: Layer) => {
        const layerExists = this.selectedLayers.find(selectedLayer => selectedLayer.value === layer.value);
        if (!layerExists) {
          this.addLayer(layer, true);
        }
      });
    });

    this.sidebarService.sidebarLayerGroupDeselect.subscribe((itemDeselected: LayerGroup) => {
      this.clearMarkerInfo();
      this.clearReportTable();
      const layers = itemDeselected.children;
      layers.forEach((layer: Layer) => {
        this.removeLayer(layer, true);
        this.tableService.unloadTableData.next(layer);
      });
    });

    this.sidebarService.sidebarItemRadioSelect.subscribe((layer: Layer) => {
      this.selectedPrimaryLayer = layer;
      this.clearMarkerInfo();
      this.clearReportTable();
      layer.markerSelected = true;
      this.updateMarkers(layer);
    });

    this.sidebarService.sidebarItemRadioDeselect.subscribe((layer: Layer) => {
      if (this.selectedPrimaryLayer && this.selectedPrimaryLayer.value === layer.value) {
        this.selectedPrimaryLayer = null;
      }
      layer.markerSelected = false;
      this.clearMarkerInfo();
      this.clearReportTable();
      if (this.selectedMarker && this.selectedMarker.overlayName === layer.label) {
        this.markerClusterGroup.clearLayers();
      }
    });

    this.mapService.resetLayers.subscribe(items => {
      const draggedItemFrom = items[0].item;
      const draggedItemFromIndex = items[0].index;

      const draggedItemTo = items[1].item;
      const draggedItemToIndex = items[1].index;

      this.map.eachLayer((layer: L.TileLayer.WMS) => {
        if (layer.options.layers === draggedItemFrom.layerData.layers) {
          layer.setZIndex(draggedItemToIndex);
        }
        if (layer.options.layers === draggedItemTo.layerData.layers) {
          layer.setZIndex(draggedItemFromIndex);
        }
      });
    });
  }

  setSpecificSearch(layer, filter, cFilter) {
    let cqlFilter = cFilter;

    if (filter.specificSearch && filter.specificSearch.isChecked) {
      if (filter.specificSearch.CarCPF === 'CAR') {
        cqlFilter = ` de_car_validado_sema_numero_do1 = '${filter.specificSearch.inputValue}' `;
      } else if (filter.specificSearch.CarCPF === 'CPF') {
        // Missing table associating CARs with CPFCNPJ
        cqlFilter = ``;
      }
    }

    return cqlFilter;
  }

  setThemeSelected(layer, filter, cFilter) {
    let cqlFilter = cFilter;
    if (filter.themeSelected && filter.themeSelected.type) {

      if (filter.themeSelected.type === 'biome') {
        if (layer.codgroup === 'FOCOS') {
          const column = (layer.isPrimary) ? `dd_focos_inpe_bioma` : `apv_car_focos_48_dd_focos_inpe_bioma`;
          cqlFilter += cqlFilter ? ', ' : '';
          cqlFilter += ` ${column} = '${filter.themeSelected.value.name}' `;
        } else {
          const column = `gid`;
          cqlFilter += cqlFilter ? ', ' : '';
          cqlFilter += ` ${column} = ${filter.themeSelected.value.gid} `;
        }
      } else if (filter.themeSelected.type === 'region') {
        if (layer.codgroup === 'FOCOS') {
          // const column = (layer.isPrimary) ? `dd_focos_inpe_bioma` : `apv_car_focos_48_dd_focos_inpe_bioma`;
          // cqlFilter += ` ${column} = '${filter.themeSelected.value.name}' `;
        } else {

        }
      } else if (filter.themeSelected.type === 'mesoregion') {
        if (layer.codgroup === 'FOCOS') {
          // const column = (layer.isPrimary) ? `dd_focos_inpe_bioma` : `apv_car_focos_48_dd_focos_inpe_bioma`;
          // cqlFilter += ` ${column} = '${filter.themeSelected.value.name}' `;
        } else {

        }
      } else if (filter.themeSelected.type === 'microregion') {
        if (layer.codgroup === 'FOCOS') {
          // const column = (layer.isPrimary) ? `dd_focos_inpe_bioma` : `apv_car_focos_48_dd_focos_inpe_bioma`;
          // cqlFilter += ` ${column} = '${filter.themeSelected.value.name}' `;
        } else {

        }
      } else if (filter.themeSelected.type === 'city') {
        if (layer.codgroup === 'FOCOS') {
          const column = (layer.isPrimary) ? `dd_focos_inpe_id_2` : `apv_car_focos_48_dd_focos_inpe_id_2`;
          cqlFilter += cqlFilter ? ', ' : '';
          // tslint:disable-next-line:radix
          cqlFilter += ` ${column} = ${parseInt(filter.themeSelected.value.geocodigo)} `;
        } else {

        }
      } else if (filter.themeSelected.type === 'uc') {

      } else if (filter.themeSelected.type === 'ti') {

      } else if (filter.themeSelected.type === 'projus') {

      }
    }
    return cqlFilter;
  }

  setAlertType(layer, filter, cFilter) {
    let cqlFilter = cFilter;
    if (filter.alertType && (filter.alertType.radioValue !== 'ALL') && (filter.alertType.analyzes.length > 0)) {
      filter.alertType.analyzes.forEach(analyze => {

        const values = this.getValues(analyze);

        if (analyze.valueOption && analyze.valueOption.value) {
          if ((analyze.type && analyze.type === 'deter') && (layer.codgroup === 'DETER')) {
            cqlFilter += cqlFilter ? ', ' : '';
            cqlFilter += ` calculated_area_ha ${values.columnValue} `;
          }

          if ((analyze.type && analyze.type === 'deforestation') && (layer.codgroup === 'PRODES')) {
            cqlFilter += cqlFilter ? ', ' : '';
            cqlFilter += ` calculated_area_ha ${values.columnValue} `;
          }

          if ((analyze.type && analyze.type === 'burned') && (layer.codgroup === 'FOCOS')) {
            cqlFilter += cqlFilter ? ', ' : '';
            cqlFilter += ` HAVING count(1) ${values.columnValueFocos} `;
          }

          if ((analyze.type && analyze.type === 'burned_area') && (layer.codgroup === 'AREA_QUEIMADA')) {
            cqlFilter += cqlFilter ? ', ' : '';
            cqlFilter += ` AND calculated_area_ha ${values.columnValue} `;
          }

          if ((analyze.type && analyze.type === 'car_area')) {
            // secondaryTables += ' , public.de_car_validado_sema car ';
            // cqlFilter += ` AND car.area_ha_ ${values.columnValue} `;
            // cqlFilter += ` AND car.numero_do1 = ${columns.column1} `;
          }
        }
      });
    }
    return cqlFilter;
  }

  getValues(analyze) {
    const values = {columnValue: '', columnValueFocos: ''};
    if (analyze.valueOption && analyze.valueOption.value) {
      switch (analyze.valueOption.value) {
        case 1 :
          values.columnValue = ` <= 5 `;
          values.columnValueFocos = ` BETWEEN 0 AND 10 `;
          break;
        case 2:
          values.columnValue = ` BETWEEN 5 AND 25 `;
          values.columnValueFocos = ` BETWEEN 10 AND 20 `;
          break;
        case 3:
          values.columnValue = ` BETWEEN 25 AND 50 `;
          values.columnValueFocos = ` BETWEEN 20 AND 50 `;
          break;
        case 4:
          values.columnValue = ` BETWEEN 50 AND 100 `;
          values.columnValueFocos = ` BETWEEN 50 AND 100 `;
          break;
        case 5:
          values.columnValue = ` >= 100 `;
          values.columnValueFocos = ` > 100 `;
          break;
        case 6:
          values.columnValue = ` > ${analyze.valueOptionBiggerThen} `;
          values.columnValueFocos = ` > ${analyze.valueOptionBiggerThen} `;
          break;
      }
    }
    return values;
  }

  setCqlFilter(layer) {
    const filter = JSON.parse(localStorage.getItem('filterList'));

    let cqlFilter = ``;

    if (filter) {
      cqlFilter = this.setThemeSelected(layer, filter, cqlFilter);
      cqlFilter = this.setAlertType(layer, filter, cqlFilter);
      cqlFilter = this.setSpecificSearch(layer, filter, cqlFilter);
    }

    if (cqlFilter) {
      layer.layerData.cql_filter = cqlFilter;
    }

    return layer;
  }

  setFilter(layer) {
    if (layer.type === LayerType.ANALYSIS || layer.type === LayerType.DYNAMIC) {
      const currentDateInput = JSON.parse(localStorage.getItem('dateFilter'));

      layer.layerData.time = `${currentDateInput[0]}/${currentDateInput[1]}`;

      layer = this.setCqlFilter(layer);
    }
    return layer;
  }

  addLayer(layer, addLayer) {
    let layerToAdd = null;
    if (layer && layer.layerData) {
      if (addLayer) {
        this.selectedLayers.push(layer);
      }
      layer = this.setFilter(layer);
      layerToAdd = this.getLayer(layer.layerData);
      layerToAdd.setZIndex(1000 + this.selectedLayers.length);
      layerToAdd.addTo(this.map);
    }
    return layerToAdd;
  }

  removeLayer(layer, deselectLayer) {
    if (layer) {
      if (deselectLayer) {
        this.selectedLayers.splice(this.selectedLayers.findIndex(selectedLayer => selectedLayer.value === layer.value), 1);
      }
      if (layer instanceof L.TileLayer.WMS) {
        layer.removeFrom(this.map);
        return;
      }
      const layerData = layer.layerData;
      let zindex = 0;
      if (!layerData) {
        return;
      }
      this.map.eachLayer((mapLayer: L.TileLayer.WMS) => {

        if (mapLayer.options.layers === layerData.layers) {
          zindex = mapLayer.options.zIndex;
          mapLayer.removeFrom(this.map);
        }

        if (mapLayer.options.zIndex > zindex) {
          mapLayer.setZIndex((mapLayer.options.zIndex - 1));
        }

      });
    }
  }

  getLayer(layerData) {
    layerData.crs = L.CRS.EPSG4326;
    return L.tileLayer.wms(layerData.url, layerData);
  }

  panMap(latlng, zoom) {
    this.map.setView(latlng, zoom);
  }

  // Map controls

  setLayerControl() {
    this.layerControl = L.control.layers(
      {}, {},
      this.mapConfig.controls.layers
    ).addTo(this.map);
  }

  setFullScreenControl() {
    this.map.addControl(L.control.fullscreen(this.mapConfig.controls.fullscreen));
  }

  setScaleControl() {
    this.map.addControl(L.control.scale(this.mapConfig.controls.scale));
  }

  setLegendControl() {
    const Legend = L.Control.extend({
      onAdd: () => {
        const div = L.DomUtil.create('div');
        div.innerHTML = `
          <div id="legendBtn" class="leaflet-control-layers leaflet-custom-icon leaflet-legend" title="Legendas">
            <a><i class='fas fa-th-list'></i></a>
          </div>`;
        return div;
      }
    });

    new Legend({ position: 'topleft' }).addTo(this.map);

    this.setLegendControlEvent();
  }

  setLegendControlEvent() {
    L.DomEvent.on(L.DomUtil.get('legendBtn'), 'dblclick', L.DomEvent.stopPropagation);
    document.querySelector('#legendBtn').addEventListener('click', () => this.displayLegend = !this.displayLegend);
  }

  setTableControl() {
    const Table = L.Control.extend({
      onAdd: () => {
        const div = L.DomUtil.create('div');
        div.innerHTML = `
          <div id="tableBtn" class="leaflet-control-layers leaflet-custom-icon" title="Tabela">
            <a><i class='fas fa-table'></i></a>
          </div>`;
        return div;
      }
    });

    new Table({ position: 'topleft' }).addTo(this.map);

    this.setTableControlEvent();
  }

  setTableControlEvent() {
    L.DomEvent.on(L.DomUtil.get('tableBtn'), 'dblclick', L.DomEvent.stopPropagation);
    document.querySelector('#tableBtn').addEventListener('click', () => this.displayTable = !this.displayTable);
  }

  setSearchControl() {
    const searchOptions = this.mapConfig.controls.search;
    searchOptions.moveToLocation = latlng => {
      this.markerClusterGroup.eachLayer((marker: L.Marker) => {
        if (marker.getLatLng().equals(latlng)) {
          this.panMap(latlng, 18);
          marker.fire('click');
        }
      });
    };
    searchOptions.marker = L.circleMarker([0, 0], this.mapConfig.controls.search.marker);
    this.searchControl = new Search(searchOptions);
    this.map.addControl(this.searchControl);
  }

  setInfoControl() {
    const Info = L.Control.extend({
      onAdd: () => {
        const div = L.DomUtil.create('div');
        div.innerHTML = `
          <div id="infoBtn" class="leaflet-control-layers leaflet-custom-icon leaflet-info" title="Informação">
            <a><i class='fas fa-info'></i></a>
          </div>`;
        return div;
      }
    });

    new Info({ position: 'topleft' }).addTo(this.map);

    this.setInfoControlEvent();
  }

  setInfoControlEvent() {
    L.DomEvent.on(L.DomUtil.get('infoBtn'), 'dblclick click', L.DomEvent.stopPropagation);
    document.querySelector('#infoBtn').addEventListener('click', () => {
      if (this.displayInfo === false) {
        this.displayInfo = true;
        document.querySelector('#infoBtn').classList.add('leaflet-custom-icon-selected');
        document.querySelector('#map').classList.remove('cursor-grab');
        document.querySelector('#map').classList.add('cursor-help');
        this.map.on('click', (event: L.LeafletMouseEvent) => this.getFeatureInfo(event));
      } else {
        this.displayInfo = false;
        document.querySelector('#infoBtn').classList.remove('leaflet-custom-icon-selected');
        document.querySelector('#map').classList.remove('cursor-help');
        document.querySelector('#map').classList.add('cursor-grab');
        this.map.off('click');
      }
    });
  }

  async getFeatureInfo(event: L.LeafletMouseEvent) {
    const latLong = event.latlng;
    let popupContent = `<div class="popup-container">`;

    if (this.selectedLayers.length === 0) {
      popupContent += `<h2>Layer não encontrado.</h2>`;
    }

    let popupTable = '';
    for (const selectedLayer of this.selectedLayers) {
      const layer = this.getLayer(selectedLayer.layerData);
      const layerName = selectedLayer.label;

      let params = null;
      let url = '';
      if (selectedLayer.type === LayerType.ANALYSIS || selectedLayer.type === LayerType.DYNAMIC) {
        url = `http://www.terrama2.dpi.inpe.br/mpmt/geoserver/wfs`;
        params = this.getWFSFeatureInfoParams(layer);
      } else {
        url = `http://www.terrama2.dpi.inpe.br/mpmt/geoserver/wms`;
        params = this.getWMSFeatureInfoParams(layer, event);
      }

      await this.hTTPService.get(url, params).toPromise().then((layerInfo: LayerInfo) => {
        const features = layerInfo.features;
        if (features && features.length > 0) {
          popupTable += this.getFeatureInfoPopup(layerName, features);
        }
      });
    }
    if (!popupTable) {
      popupTable = 'Nenhuma informação foi encontrada.';
    }
    popupContent += popupTable;

    popupContent += `</div>`;

    this.clearMarkerInfo();

    this.markerInfo = this.createMarker('info', popupContent, latLong, '');
    if (this.markerInfo) {
      this.markerInfo.addTo(this.map);
      this.markerInfo.openPopup();
    }
  }

  getWMSFeatureInfoParams(layer: L.TileLayer.WMS, event: L.LeafletMouseEvent) {
    const layerPoint = this.map.layerPointToContainerPoint(event.layerPoint);
    const bbox = this.map.getBounds().toBBoxString();
    const mapSize = this.map.getSize();
    const width = mapSize.x;
    const height = mapSize.y;
    const x = Math.round(layerPoint.x);
    const y = Math.round(layerPoint.y);
    const params = {
      request: 'GetFeatureInfo',
      service: 'WMS',
      srs: 'EPSG:4326',
      styles: layer.wmsParams.styles,
      transparent: layer.wmsParams.transparent,
      version: layer.wmsParams.version,
      format: layer.wmsParams.format,
      bbox,
      height,
      width,
      layers: layer.wmsParams.layers,
      query_layers: layer.wmsParams.layers,
      info_format: 'application/json',
      x,
      y
    };
    return params;
  }

  getWFSFeatureInfoParams(layer: L.TileLayer.WMS) {
    const params = {
      request: 'GetFeature',
      service: 'WFS',
      srs: 'EPSG:4326',
      version: '2.0',
      outputFormat: 'application/json',
      typeNames: layer.wmsParams.layers,
      count: 1
    };
    return params;
  }

  getFeatureInfoPopup(layerName: string, features: LayerInfoFeature[]) {
    let popupContent = '';
    if (features) {
      features.forEach(feature => {
        const properties = feature.properties;
        if (properties) {
          popupContent += this.getPopupContent(properties, layerName);
        }
      });
    }
    return popupContent;
  }

  getPopupContent(data, name) {
    let popupContent = '';
    let popupContentBody = '';
    Object.keys(data).forEach(key => {
      if (key !== 'lat' &&
          key !== 'long' &&
          key !== 'geom' &&
          key !== 'intersection_geom' &&
          key !== 'bbox'
          ) {
        popupContentBody += `
            <tr>
              <td>${key}</td>
              <td>${data[key]}</td>
            </tr>
        `;
      }
    });

    popupContent += `
        <br />
        <div class="table-responsive">
          <table class="table table-hover">
              <thead><th colspan="2">${name}</th></thead>
              ${popupContentBody}
          </table>
        </div>
    `;

    return popupContent;
  }

  setRestoreMapControl() {
    const RestoreMap = L.Control.extend({
      onAdd: () => {
        const div = L.DomUtil.create('div');
        div.innerHTML = `
          <div id="restoreMapBtn" class="leaflet-control-layers leaflet-custom-icon leaflet-restore-map" title="Restaurar mapa">
            <a><i class='fas fa-crosshairs'></i></a>
          </div>`;
        return div;
      }
    });

    new RestoreMap({ position: 'topleft' }).addTo(this.map);

    this.setRestoreMapControlEvent();
  }

  setRestoreMapControlEvent() {
    const initialLatLong = this.mapConfig.initialLatLong;
    const initialZoom = this.mapConfig.initialZoom;
    L.DomEvent.on(L.DomUtil.get('restoreMapBtn'), 'dblclick', L.DomEvent.stopPropagation);
    document.querySelector('#restoreMapBtn')
            .addEventListener('click', () => this.panMap(initialLatLong, initialZoom));
  }

  setVisibleLayersControl() {
    const VisibleLayers = L.Control.extend({
      onAdd: () => {
        const div = L.DomUtil.create('div');
        div.innerHTML = `
          <div id="visibleLayersBtn" class="leaflet-control-layers leaflet-custom-icon" title="Layers visíveis">
            <a><i class='fas fa-list'></i></a>
          </div>`;
        return div;
      }
    });

    new VisibleLayers({ position: 'topleft' }).addTo(this.map);

    this.setVisibleLayersControlEvent();
  }

  setVisibleLayersControlEvent() {
    document.querySelector('#visibleLayersBtn')
            .addEventListener('click', () => {
              this.displayVisibleLayers = !this.displayVisibleLayers;
              L.DomEvent.on(L.DomUtil.get('visibleLayersBtn'), 'dblclick', L.DomEvent.stopPropagation);
    });
  }

  // Events
  onShowTable() {
    this.displayTable = true;
  }

  onHideTable() {
    this.displayTable = false;
  }

  clearLayers() {
    this.selectedLayers.forEach(layer => this.removeLayer(layer, false));
  }

  updateLayers() {
    this.selectedLayers.forEach(layer => {
      if (layer.markerSelected) {
        this.updateMarkers(layer);
      }

      this.addLayer(layer, false);
    });
  }

  private updateMarkers(layer: Layer) {
    this.markerClusterGroup.clearLayers();

    const url = this.configService.getAppConfig('layerUrls')[layer.type];
    const popupTitle = layer.carRegisterColumn;
    const label = layer.label;

    const view = JSON.stringify(
      new View(
        layer.value,
        layer.cod,
        layer.codgroup,
        (layer.type === LayerType.ANALYSIS),
        layer.isPrimary
    ));

    const date = JSON.parse(localStorage.getItem('dateFilter'));

    const filter = localStorage.getItem('filterList');

    this.hTTPService.get(url, {view, date, filter})
                    .subscribe(data => this.setMarkers(data, popupTitle, label));
  }

  clearReportTable() {
    if (this.tableReportActive) {
      this.tableService.clearTable.next();
      this.tableReportActive = false;
      this.markerClusterGroup.clearLayers();
      this.clearLayers();
      this.tableSelectedLayer = null;
      this.selectedLayers = [];
    }
  }

  clearMarkerInfo() {
    if (this.markerInfo) {
      this.markerInfo.removeFrom(this.map);
      this.markerInfo = null;
    }
  }

  expandShrinkTable() {
    if (this.sidebarTableHeight === '48vh') {
      this.sidebarTableHeight = 'calc(100vh - 50px)';
      this.tableHeight = '78vh';
      this.tableFullscreen = true;
    } else if (this.sidebarTableHeight === 'calc(100vh - 50px)') {
      this.sidebarTableHeight = '48vh';
      this.tableHeight = '30vh';
      this.tableFullscreen = false;
    } else if (this.sidebarTableHeight === '28vh') {
      this.sidebarTableHeight = '48vh';
      this.tableHeight = '30vh';
      this.tableFullscreen = false;
    }
  }
}
