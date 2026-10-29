// app/index.tsx
import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Platform,
  Alert,
} from "react-native";
import RelocMap, { RelocMapRef } from "../components/RelocMap";
import * as Location from "expo-location";
import PlaceSearchBar from "../components/PlaceSearchBar";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getCityFromCoord } from "../utils/location";

const { width, height } = Dimensions.get("window");


export default function SetLocationScreen() {
  const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || "";
  const router = useRouter();

  // const params = useLocalSearchParams();
  const mapRef = useRef<RelocMapRef | null>(null);
  const { mode, lat, lng, returnTo } = useLocalSearchParams();
  const isPlaceMode = mode === "place";


  const [region, setRegion] = useState({
    latitude: 28.6139,
    longitude: 77.2090,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  });

  useEffect(() => {
    (async () => {
      const req = await Location.requestForegroundPermissionsAsync();
    })();
  }, []);

  const savePreviousCity = async () => {
    const city = await getCityFromCoord(
      region.latitude,
      region.longitude
    );

    try {
      await AsyncStorage.setItem(
        "previous_city",
        JSON.stringify({
          name: city.name,
          level: city.level,
          coordinates: {
            lat: region.latitude,
            lng: region.longitude,
          },
        })
      );
      console.log("✅ SAVED previous_city:", city);
    } catch (error) {
      console.error("❌ Storage error:", error);
      Alert.alert("Error", "Failed to save location");
    }
  };

  useEffect(() => {
    if (isPlaceMode && lat && lng) {
      const newRegion = {
        latitude: Number(lat),
        longitude: Number(lng),
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      };

      setRegion(prev => {
        // 🛑 prevent unnecessary state updates
        if (
          prev.latitude === newRegion.latitude &&
          prev.longitude === newRegion.longitude
        ) {
          return prev;
        }
        return newRegion;
      });

      mapRef.current?.animateToRegion(newRegion, 600);
    }
  }, [isPlaceMode, lat, lng]);


const handleRegionChangeComplete = (newRegion: any) => {
  if (!isPlaceMode) {
    setRegion(newRegion);
  }
};


// get current device location
const getCurrentLocation = async () => {
  const lastLocation = await Location.getLastKnownPositionAsync();
  if (lastLocation) {
    setRegion({
      latitude: lastLocation.coords.latitude,
      longitude: lastLocation.coords.longitude,
      latitudeDelta: 0.05,
      longitudeDelta: 0.05,
    });
  }

  // 2. Fetch fresh location in background
  const location = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced, // 🔥 KEY CHANGE
  });

  setRegion({
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  });
};

const handleConfirm = async () => {
  const targetPath = (Array.isArray(returnTo) ? returnTo[0] : returnTo) || "/frequent-places";

  //place mode - just go back
  if (isPlaceMode) {
    router.push(targetPath as any);
    return;
  }

  //save previous city
  await savePreviousCity();
  // ✅ PICK MODE
  router.push({
    pathname: targetPath as any,
    params: {
      latitude: String(region.latitude),
      longitude: String(region.longitude),
    },
  });
};

return (
  <View style={styles.container}>
    {/* Search bar */}
    {!isPlaceMode && (
      <View style={styles.searchBox}>
        <PlaceSearchBar
          placeholder="Search for a location or city"
          onPress={(data, details = null) => {
            if (!details) return;
            const { lat, lng } = details.geometry.location;

            const newRegion = {
              ...region,
              latitude: lat,
              longitude: lng,
            };

            setRegion(newRegion);
            mapRef.current?.animateToRegion(newRegion, 800);
          }}
          query={{
            key: GOOGLE_MAPS_API_KEY,
            language: "en",
          }}
        />
      </View>
    )}

    {/* Map */}
    <RelocMap
      ref={mapRef}
      style={styles.map}
      region={region}
      isPlaceMode={isPlaceMode}
      pinCoordinate={isPlaceMode && lat && lng ? { latitude: Number(lat), longitude: Number(lng) } : null}
      onRegionChangeComplete={handleRegionChangeComplete}
    />


    {/* Center pin (overlay) */}
    {!isPlaceMode && (
      <View pointerEvents="none" style={styles.centerPinWrapper}>
        <View style={styles.centerPinOuter}>
          <View style={styles.centerPinInner} />
        </View>
      </View>
    )}

    {/* Zoom & current location controls */}
    <View style={styles.mapControls}>
      <TouchableOpacity
        style={styles.controlButton}
        onPress={() =>
          mapRef.current?.animateToRegion(
            {
              ...region,
              latitudeDelta: region.latitudeDelta * 0.7,
              longitudeDelta: region.longitudeDelta * 0.7,
            },
            200
          )
        }
      >
        <Ionicons name="add" size={20} color="#111827" />
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.controlButton}
        onPress={() =>
          mapRef.current?.animateToRegion(
            {
              ...region,
              latitudeDelta: region.latitudeDelta / 0.7,
              longitudeDelta: region.longitudeDelta / 0.7,
            },
            200
          )
        }
      >
        <Ionicons name="remove" size={20} color="#111827" />
      </TouchableOpacity>
      <TouchableOpacity style={styles.controlButton} onPress={getCurrentLocation}>
        <Ionicons name="locate" size={20} color="#0F766E" />
      </TouchableOpacity>
    </View>

    {/* Bottom sheet */}
    {!isPlaceMode && (
      <View style={styles.bottomSheet}>
        <TouchableOpacity style={styles.useLocationBtn} onPress={getCurrentLocation}>
          <Ionicons name="navigate" size={18} color="#0F766E" />
          <Text style={styles.useLocationText}>Use my current location</Text>
        </TouchableOpacity>

        <Text style={styles.coordsText}>
          LAT: {region.latitude.toFixed(4)}, LONG: {region.longitude.toFixed(4)}
        </Text>

        <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirm}>
          <Text style={styles.confirmText}>Confirm Location</Text>
        </TouchableOpacity>
      </View>
    )}
  </View>
);
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" },

  header: {
    position: "absolute",
    top: Platform.OS === "ios" ? 50 : 30,
    left: 0,
    right: 0,
    zIndex: 20,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  headerIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.95)",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
  },

  map: {
    width,
    height,
  },

  searchBox: {
    position: "absolute",
    top: Platform.OS === "ios" ? 40 : 20,
    width: "90%",
    borderRadius: 28,
    alignSelf: "center",
    zIndex: 15,
  },

  centerPinWrapper: {
    position: "absolute",
    top: height / 2 - 32,
    left: width / 2 - 16,
    zIndex: 5,
    alignItems: "center",
  },
  centerPinOuter: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#0F766E",
    justifyContent: "center",
    alignItems: "center",
  },
  centerPinInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#FFFFFF",
  },

  mapControls: {
    position: "absolute",
    right: 18,
    top: height / 2 - 40,
    zIndex: 10,
  },
  controlButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },

  bottomSheet: {
    position: "absolute",
    bottom: 0,
    width: "100%",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: -2 },
  },
  useLocationBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F3F4F6",
    borderRadius: 999,
    paddingVertical: 12,
    paddingHorizontal: 18,
    marginBottom: 12,
  },
  useLocationText: {
    marginLeft: 8,
    fontSize: 15,
    fontWeight: "500",
    color: "#111827",
  },
  coordsText: {
    textAlign: "center",
    marginBottom: 14,
    color: "#6B7280",
    fontSize: 13,
  },
  confirmBtn: {
    backgroundColor: "#0F766E",
    paddingVertical: 16,
    borderRadius: 999,
  },
  confirmText: {
    textAlign: "center",
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
});
