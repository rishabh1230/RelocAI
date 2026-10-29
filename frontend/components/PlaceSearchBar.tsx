import React, { useState, useEffect, useRef } from "react";
import {
  View,
  TextInput,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

export interface PlaceSearchBarProps {
  placeholder?: string;
  onPress: (data: any, details: any) => void;
  query?: {
    key?: string;
    language?: string;
  };
  styles?: any;
}

export default function PlaceSearchBar({
  placeholder = "Search for a location",
  onPress,
  query,
  styles: customStyles = {},
}: PlaceSearchBarProps) {
  const [text, setText] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const debounceTimer = useRef<any>(null);

  const apiKey = query?.key || "";

  useEffect(() => {
    if (!text || text.trim().length < 2) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    debounceTimer.current = setTimeout(async () => {
      setLoading(true);
      try {
        let found = false;

        // 1. Try Google Places Autocomplete if key is available
        if (apiKey) {
          try {
            const googleUrl = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(
              text
            )}&key=${apiKey}&language=en`;
            const resp = await fetch(googleUrl);
            const data = await resp.json();
            if (data.status === "OK" && data.predictions?.length) {
              setResults(
                data.predictions.map((p: any) => ({
                  id: p.place_id,
                  description: p.description,
                  source: "google",
                }))
              );
              setIsOpen(true);
              found = true;
            }
          } catch {
            // Fall through to OSM
          }
        }

        // 2. OpenStreetMap Nominatim Fallback
        if (!found) {
          const osmUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
            text
          )}&format=json&limit=5&addressdetails=1`;
          const resp = await fetch(osmUrl, {
            headers: { "User-Agent": "RelocAI-Platform/1.0" },
          });
          const data = await resp.json();
          if (Array.isArray(data) && data.length) {
            setResults(
              data.map((item: any) => ({
                id: String(item.osm_id || Math.random()),
                description: item.display_name,
                lat: Number(item.lat),
                lng: Number(item.lon),
                source: "osm",
              }))
            );
            setIsOpen(true);
          }
        }
      } catch (err) {
        console.warn("Search error:", err);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [text, apiKey]);

  const handleSelect = async (item: any) => {
    setText(item.description.split(",")[0] || item.description);
    setIsOpen(false);
    setResults([]);

    if (item.source === "google") {
      try {
        const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${item.id}&fields=geometry&key=${apiKey}`;
        const resp = await fetch(detailsUrl);
        const data = await resp.json();
        if (data.status === "OK" && data.result?.geometry?.location) {
          onPress(item, data.result);
          return;
        }
      } catch {
        // Fallback
      }
    }

    // Direct coords from OSM
    if (typeof item.lat === "number" && typeof item.lng === "number") {
      onPress(item, {
        geometry: {
          location: {
            lat: item.lat,
            lng: item.lng,
          },
        },
      });
    }
  };

  return (
    <View style={[styles.wrapper, customStyles.container]}>
      <View style={[styles.inputRow, customStyles.textInputContainer]}>
        <Ionicons name="search" size={18} color="#6B7280" style={styles.searchIcon} />
        <TextInput
          placeholder={placeholder}
          placeholderTextColor="#9CA3AF"
          value={text}
          onChangeText={setText}
          style={[styles.input, customStyles.textInput]}
          onFocus={() => {
            if (results.length > 0) setIsOpen(true);
          }}
        />
        {loading && <ActivityIndicator size="small" color="#0F766E" style={styles.loader} />}
        {text.length > 0 && (
          <TouchableOpacity
            onPress={() => {
              setText("");
              setResults([]);
              setIsOpen(false);
            }}
          >
            <Ionicons name="close-circle" size={18} color="#9CA3AF" />
          </TouchableOpacity>
        )}
      </View>

      {isOpen && results.length > 0 && (
        <View style={[styles.dropdown, customStyles.listView]}>
          <FlatList
            data={results}
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.resultItem} onPress={() => handleSelect(item)}>
                <Ionicons name="location-outline" size={16} color="#0F766E" style={styles.itemIcon} />
                <Text style={styles.resultText} numberOfLines={2}>
                  {item.description}
                </Text>
              </TouchableOpacity>
            )}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: "100%",
    zIndex: 999,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    paddingHorizontal: 14,
    height: 48,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  searchIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: "#111827",
    paddingVertical: Platform.OS === "web" ? 8 : 4,
  },
  loader: {
    marginRight: 6,
  },
  dropdown: {
    marginTop: 6,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    maxHeight: 220,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
    overflow: "hidden",
  },
  resultItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  itemIcon: {
    marginRight: 10,
  },
  resultText: {
    flex: 1,
    fontSize: 14,
    color: "#374151",
  },
});
