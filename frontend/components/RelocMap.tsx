import React, { forwardRef, useImperativeHandle, useRef } from "react";
import { StyleSheet, View } from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";

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
    const mapRef = useRef<MapView | null>(null);

    useImperativeHandle(ref, () => ({
      animateToRegion: (newRegion: MapRegion, duration = 600) => {
        mapRef.current?.animateToRegion(newRegion, duration);
      },
    }));

    return (
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        mapType="standard"
        style={style || styles.map}
        region={region}
        onRegionChangeComplete={onRegionChangeComplete}
      >
        {isPlaceMode && pinCoordinate && (
          <Marker coordinate={pinCoordinate} />
        )}
      </MapView>
    );
  }
);

export default RelocMap;

const styles = StyleSheet.create({
  map: {
    width: "100%",
    height: "100%",
  },
});
