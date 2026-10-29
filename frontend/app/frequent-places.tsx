// FrequentPlacesScreen.tsx
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";

const PLACES_KEY = "frequent-places";
// 1. Define a key for the temporary form data
const DRAFT_KEY = "frequent-places-draft";

type Place = {
  id: string;
  name: string;
  category: string;
  latitude: number;
  longitude: number;
};

const CATEGORIES = ["Café", "Restaurant", "Park", "Gym"];

export default function FrequentPlacesScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    latitude?: string;
    longitude?: string;
  }>();

  const [placeName, setPlaceName] = useState("");
  const [category, setCategory] = useState("");
  const [pickedCoords, setPickedCoords] = useState<{
    latitude: number | null;
    longitude: number | null;
  }>({ latitude: null, longitude: null });
  const [places, setPlaces] = useState<Place[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load places AND the draft form data on mount
  useEffect(() => {
    (async () => {
      try {
        // Load the list of places
        const storedPlaces = await AsyncStorage.getItem(PLACES_KEY);
        if (storedPlaces) {
          setPlaces(JSON.parse(storedPlaces));
        }

        // 2. Load the draft form data (if user is coming back from map)
        const storedDraft = await AsyncStorage.getItem(DRAFT_KEY);
        if (storedDraft) {
          const draft = JSON.parse(storedDraft);
          if (draft.placeName) setPlaceName(draft.placeName);
          if (draft.category) setCategory(draft.category);
        }
      } catch (e) {
        console.warn("Failed to load data", e);
      } finally {
        setIsLoaded(true);
      }
    })();
  }, []);

  // Whenever places changes, save the list
  useEffect(() => {
    if (!isLoaded) return;
    AsyncStorage.setItem(PLACES_KEY, JSON.stringify(places)).catch(() =>
      console.warn("Failed to save places")
    );
  }, [places, isLoaded]);

  // Read coords coming back from index (map) screen
  useEffect(() => {
    if (params.latitude && params.longitude) {
      setPickedCoords({
        latitude: Number(params.latitude),
        longitude: Number(params.longitude),
      });
    }
  }, [params.latitude, params.longitude]);

  const canAdd =
    placeName.trim() !== "" &&
    category !== "" &&
    pickedCoords.latitude !== null &&
    pickedCoords.longitude !== null;

  const canContinue = places.length >= 1;

  const openLocationPicker = async () => {
    // 3. Save current inputs as a draft before navigating away
    try {
      await AsyncStorage.setItem(
        DRAFT_KEY,
        JSON.stringify({ placeName, category })
      );
    } catch (e) {
      console.warn("Failed to save draft", e);
    }

    router.push({
      pathname: "/",
      params: {
        mode: "pick",
        returnTo: "/frequent-places",
      },
    });
  };

  const handleAddPlace = async () => {
    if (!canAdd || places.length >= 3) return;
    setPlaces((prev) => [
      ...prev,
      {
        id: String(Date.now()),
        name: placeName.trim(),
        category,
        latitude: pickedCoords.latitude!,
        longitude: pickedCoords.longitude!,
      },
    ]);

    // 4. Clear the inputs AND the draft from storage
    setPlaceName("");
    setCategory("");
    setPickedCoords({ latitude: null, longitude: null });
    await AsyncStorage.removeItem(DRAFT_KEY);
  };

  const removePlace = (id: string) => {
    setPlaces((prev) => prev.filter((p) => p.id !== id));
  };

  const renderPlace = ({ item }: { item: Place }) => (
    <View style={styles.placeCard}>
      <View style={styles.placeIconCircle}>
        <Text style={styles.placeIconText}>☕</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.placeName}>{item.name}</Text>
        <Text style={styles.placeCategory}>{item.category.toUpperCase()}</Text>
        <Text style={styles.placeCoords}>
          {item.latitude.toFixed(4)}° N, {Math.abs(item.longitude).toFixed(4)}°{" "}
          {item.longitude < 0 ? "W" : "E"}
        </Text>
      </View>
      <TouchableOpacity
        style={styles.iconButton}
        onPress={() => removePlace(item.id)}
      >
        <Ionicons name="trash-outline" size={18} color="#6B7280" />
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe}>
      {/* <ScrollView style={styles.container}> */}
        <View style={styles.container}>
          {/* Header */}
          <Text style={styles.title}>
            What are your <Text style={styles.titleAccent}>go-to</Text> spots?
          </Text>
          <Text style={styles.subtitle}>
            Add exactly 3 places you visit often. Pin their exact location to help
            us find similar vibes.
          </Text>

          {/* Form */}
          <View style={styles.card}>
            <Text style={styles.label}>PLACE NAME</Text>
            <TextInput
              placeholder="e.g. Local Roast Cafe"
              value={placeName}
              onChangeText={setPlaceName}
              style={styles.input}
            />

            <Text style={[styles.label, { marginTop: 16 }]}>CATEGORY</Text>
            <TouchableOpacity
              style={styles.dropdown}
              onPress={() => {
                const idx = CATEGORIES.indexOf(category);
                const next =
                  CATEGORIES[(idx + 1 + CATEGORIES.length) % CATEGORIES.length];
                setCategory(next);
              }}
            >
              <Text
                style={
                  category ? styles.dropdownText : styles.dropdownPlaceholder
                }
              >
                {category || "Select category"}
              </Text>
              <View style={styles.dropdownChip} />
            </TouchableOpacity>

            {/* LOCATION */}
            <Text style={[styles.label, { marginTop: 16 }]}>LOCATION</Text>
            <TouchableOpacity
              style={[
                styles.locationBox,
                pickedCoords.latitude !== null && { borderColor: "#1E8E6E" },
              ]}
              onPress={openLocationPicker}
            >
              <Text style={styles.locationIcon}>🗺️</Text>
              <View>
                <Text style={styles.locationTitle}>Set Location on Map</Text>
                <Text style={styles.locationSubtitle}>
                  {pickedCoords.latitude
                    ? `LAT: ${pickedCoords.latitude.toFixed(
                      4
                    )}, LONG: ${pickedCoords.longitude!.toFixed(4)}`
                    : "Not set"}
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.addButton, !canAdd && styles.addButtonDisabled]}
              onPress={handleAddPlace}
              disabled={!canAdd}
            >
              <Text style={styles.addButtonIcon}>＋</Text>
              <Text style={styles.addButtonText}>Add to my list</Text>
            </TouchableOpacity>
          </View>

          {/* List */}
          <View style={styles.listHeaderRow}>
            <Text style={styles.listHeader}>YOUR LIST</Text>
            <Text style={styles.listCount}>{places.length} of 3 added</Text>
          </View>

          <FlatList
            data={places}
            keyExtractor={(item) => item.id}
            renderItem={renderPlace}
          />
        </View>

        {/* Bottom button */}
        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={[
              styles.Button,
              canContinue ? styles.active : styles.continueDisabled,
            ]}
            onPress={() => {
              if (!canContinue) return;
              router.push("/TargetCity")
            }}>
            <Text style={styles.continueText}>Continue</Text>
          </TouchableOpacity>
        </View>
      {/* </ScrollView> */}
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#F7F7F7",
  },
  container: {
    flex: 1,
    paddingHorizontal: 20,
  },
  title: {
    marginTop: 12,
    fontSize: 26,
    fontWeight: "700",
    color: "#111827",
  },
  titleAccent: {
    color: "#1E8E6E",
  },
  subtitle: {
    marginTop: 8,
    fontSize: 14,
    color: "#6B7280",
  },
  card: {
    marginTop: 20,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  label: {
    fontSize: 11,
    fontWeight: "600",
    color: "#9CA3AF",
    letterSpacing: 0.8,
  },
  input: {
    marginTop: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: "#111827",
  },
  dropdown: {
    marginTop: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dropdownText: {
    fontSize: 15,
    color: "#111827",
  },
  dropdownPlaceholder: {
    fontSize: 15,
    color: "#9CA3AF",
  },
  dropdownChip: {
    width: 18,
    height: 18,
    borderRadius: 4,
    backgroundColor: "#F97316",
  },
  locationBox: {
    marginTop: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
  },
  locationIcon: {
    marginRight: 10,
    fontSize: 22,
  },
  locationTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#047857",
  },
  locationSubtitle: {
    fontSize: 12,
    color: "#9CA3AF",
    marginTop: 2,
  },
  addButton: {
    marginTop: 18,
    borderRadius: 999,
    backgroundColor: "#0F766E",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
  },
  addButtonDisabled: {
    backgroundColor: "#93C5FD",
  },
  addButtonIcon: {
    color: "#FFFFFF",
    fontSize: 18,
    marginRight: 8,
  },
  addButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  listHeaderRow: {
    marginTop: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  listHeader: {
    fontSize: 12,
    fontWeight: "600",
    color: "#9CA3AF",
  },
  listCount: {
    fontSize: 12,
    color: "#6B7280",
  },
  placeCard: {
    marginTop: 10,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  placeIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#E0F2FE",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  placeIconText: {
    fontSize: 18,
  },
  placeName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#111827",
  },
  placeCategory: {
    marginTop: 2,
    fontSize: 11,
    color: "#22C55E",
  },
  placeCoords: {
    marginTop: 2,
    fontSize: 11,
    color: "#9CA3AF",
  },
  iconButton: {
    paddingHorizontal: 6,
  },
  placeholderCard: {
    marginTop: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#D1D5DB",
    paddingVertical: 14,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
  },
  placeholderDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderStyle: "dashed",
    marginRight: 10,
  },
  placeholderTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#9CA3AF",
  },
  placeholderSubtitle: {
    fontSize: 12,
    color: "#D1D5DB",
    marginTop: 2,
  },
  bottomBar: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    paddingTop: 8,
    backgroundColor: "#F7F7F7",
  },
  Button: {
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: "center",
    // backgroundColor: "#047857",
  },
  active: {
    backgroundColor: "#047857",
  },
  continueDisabled: {
    backgroundColor: "#A7F3D0",
  },
  continueText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  bottomHint: {
    marginTop: 6,
    fontSize: 12,
    textAlign: "center",
    color: "#9CA3AF",
  },
});

