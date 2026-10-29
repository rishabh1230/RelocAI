import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { StyleSheet, View, Text } from "react-native";

export interface MapRegion {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}

export interface RelocMapRef {
  animateToRegion: (region: MapRegion, duration?: number) => void;
}

export interface RelocMapProps {
  region: MapRegion;
  onRegionChangeComplete?: (region: MapRegion) => void;
  isPlaceMode?: boolean;
  pinCoordinate?: { latitude: number; longitude: number } | null;
  style?: any;
}

const RelocMap = forwardRef<RelocMapRef, RelocMapProps>(
  ({ region, onRegionChangeComplete, isPlaceMode, pinCoordinate, style }, ref) => {
    const iframeRef = useRef<HTMLIFrameElement | null>(null);
    const [currentCoords, setCurrentCoords] = useState({
      lat: region.latitude,
      lng: region.longitude,
    });

    useImperativeHandle(ref, () => ({
      animateToRegion: (newRegion: MapRegion) => {
        setCurrentCoords({ lat: newRegion.latitude, lng: newRegion.longitude });
        if (iframeRef.current && iframeRef.current.contentWindow) {
          iframeRef.current.contentWindow.postMessage(
            {
              type: "RELOC_SET_VIEW",
              lat: newRegion.latitude,
              lng: newRegion.longitude,
            },
            "*"
          );
        }
      },
    }));

    useEffect(() => {
      const handleMessage = (event: MessageEvent) => {
        if (event.data && event.data.type === "RELOC_MAP_MOVED") {
          const { lat, lng } = event.data;
          setCurrentCoords({ lat, lng });
          if (onRegionChangeComplete) {
            onRegionChangeComplete({
              latitude: lat,
              longitude: lng,
              latitudeDelta: region.latitudeDelta || 0.05,
              longitudeDelta: region.longitudeDelta || 0.05,
            });
          }
        }
      };

      window.addEventListener("message", handleMessage);
      return () => window.removeEventListener("message", handleMessage);
    }, [onRegionChangeComplete, region.latitudeDelta, region.longitudeDelta]);

    const initialLat = isPlaceMode && pinCoordinate ? pinCoordinate.latitude : region.latitude;
    const initialLng = isPlaceMode && pinCoordinate ? pinCoordinate.longitude : region.longitude;

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    body, html, #map { margin: 0; padding: 0; width: 100%; height: 100%; background: #e5e7eb; }
    .custom-pin {
      width: 24px;
      height: 24px;
      background: #0f766e;
      border: 3px solid #ffffff;
      border-radius: 50%;
      box-shadow: 0 4px 10px rgba(0,0,0,0.3);
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    const isPlaceMode = ${Boolean(isPlaceMode)};
    const map = L.map('map', {
      zoomControl: false,
      attributionControl: false
    }).setView([${initialLat}, ${initialLng}], 14);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19
    }).addTo(map);

    L.control.zoom({ position: 'topright' }).addTo(map);

    let marker;
    if (isPlaceMode) {
      marker = L.marker([${initialLat}, ${initialLng}]).addTo(map);
    }

    map.on('moveend', function() {
      const center = map.getCenter();
      window.parent.postMessage({
        type: 'RELOC_MAP_MOVED',
        lat: Number(center.lat.toFixed(5)),
        lng: Number(center.lng.toFixed(5))
      }, '*');
    });

    map.on('click', function(e) {
      map.panTo(e.latlng);
      window.parent.postMessage({
        type: 'RELOC_MAP_MOVED',
        lat: Number(e.latlng.lat.toFixed(5)),
        lng: Number(e.latlng.lng.toFixed(5))
      }, '*');
    });

    window.addEventListener('message', function(event) {
      if (event.data && event.data.type === 'RELOC_SET_VIEW') {
        map.setView([event.data.lat, event.data.lng], 14, { animate: true });
        if (marker) {
          marker.setLatLng([event.data.lat, event.data.lng]);
        }
      }
    });
  </script>
</body>
</html>
    `;

    return (
      <View style={[styles.container, style]}>
        <iframe
          ref={iframeRef as any}
          title="RelocAI Map"
          srcDoc={htmlContent}
          style={{
            width: "100%",
            height: "100%",
            border: "none",
          }}
        />
      </View>
    );
  }
);

export default RelocMap;

const styles = StyleSheet.create({
  container: {
    width: "100%",
    height: "100%",
    backgroundColor: "#F3F4F6",
  },
});
