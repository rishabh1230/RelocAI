import { Dimensions, Platform, StyleSheet, Text, TouchableOpacity, View, Alert, ActivityIndicator } from 'react-native'
import React, { useRef, useState } from 'react'
import PlaceSearchBar from '../components/PlaceSearchBar'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Location from 'expo-location'
import RelocMap, { RelocMapRef } from '../components/RelocMap';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getCityFromCoord } from '../utils/location';

const { width, height } = Dimensions.get("window");
const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || "";


export default function TargetCity() {
  const router = useRouter();
  const params = useLocalSearchParams(); // Access data from index and frequent-places
  const mapRef = useRef<RelocMapRef | null>(null);

  const [loading, setLoading] = useState(false);
  const [region, setRegion] = useState({
    latitude: 28.6139,
    longitude: 77.2090,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  });

  const saveCurrentCity = async () => {
    const city = await getCityFromCoord(
      region.latitude,
      region.longitude
    );

    try {
      await AsyncStorage.setItem(
        "current_city",
        JSON.stringify({
          name: city.name,
          level: city.level,
          coordinates: {
            lat: region.latitude,
            lng: region.longitude,
          },
        })
      );
      console.log("✅ SAVED current_city:", region.latitude, region.longitude);
    } catch (error) {
      console.error("❌ Storage error:", error);
      Alert.alert("Error", "Failed to save location");
    }
  };

  // get current device location

  const getCurrentLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") return;

    const location = await Location.getCurrentPositionAsync({});
    const { latitude, longitude } = location.coords;

    const newRegion = { ...region, latitude, longitude };
    setRegion(newRegion);
    mapRef.current?.animateToRegion(newRegion, 800);
  };

  const handleConfirm = async () => {
    setLoading(true);
    await saveCurrentCity();
    setLoading(false);
    router.push('/recommendations');
  };

  return (
    <View style={styles.container}>
      <View style={styles.searchBox}>
        <PlaceSearchBar
          placeholder='Search for Destination City'
          onPress={(data, details = null) => {
            if (!details) return;
            const { lat, lng } = details.geometry.location;
            const newRegion = { ...region, latitude: lat, longitude: lng };
            setRegion(newRegion);
            mapRef.current?.animateToRegion(newRegion, 800);
          }}
          query={{
            key: GOOGLE_MAPS_API_KEY,
            language: "en",
          }}
        />
      </View>

      <RelocMap
        style={styles.map}
        region={region}
        ref={mapRef}
        onRegionChangeComplete={setRegion}
      />

      <View pointerEvents="none" style={styles.centerPinWrapper}>
        <View style={styles.centerPinOuter}>
          <View style={styles.centerPinInner} />
        </View>
      </View>

      <View style={styles.bottomSheet}>
        <TouchableOpacity style={styles.useLocationBtn} onPress={getCurrentLocation}>
          <Ionicons name="locate-outline" size={20} color="#111827" />
          <Text style={styles.useLocationText}>Use Current Location</Text>
        </TouchableOpacity>

        <Text style={styles.coordsText}>
          TARGET: {region.latitude.toFixed(4)}, {region.longitude.toFixed(4)}
        </Text>

        <TouchableOpacity
          style={[styles.confirmBtn, loading && { opacity: 0.7 }]}
          onPress={handleConfirm}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.confirmText}>Get Recommendations</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  )
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
    justifyContent: "space-between",
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
    flex: 1,
  },

  searchBox: {
    position: "absolute",
    top: Platform.OS === "ios" ? 40 : 20,
    width: "90%",
    alignSelf: "center",
    borderRadius: 28,
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

  // mapControls: {
  //   position: "absolute",
  //   right: 18,
  //   top: height / 2 - 40,
  //   zIndex: 10,
  // },
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
