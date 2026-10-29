import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  recommendations?: any[];
  followup?: string | null;
  preferences?: any;
}

export default function ChatScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(false);
  const [runningPrefs, setRunningPrefs] = useState<any>({});
  const [city, setCity] = useState<string>("Bangalore");
  const flatListRef = useRef<FlatList | null>(null);

  const API_URL = process.env.EXPO_PUBLIC_API_URL
    ? process.env.EXPO_PUBLIC_API_URL.replace("/api/recommend", "/api/chat")
    : "http://localhost:5000/api/chat";

  useEffect(() => {
    (async () => {
      let initialCity = "Bangalore";
      try {
        const stored = await AsyncStorage.getItem("current_city");
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed.name && parsed.name !== "unknown") {
            initialCity = parsed.name;
          }
        }
      } catch {
        // default
      }
      setCity(initialCity);

      // Initial welcome message from RelocAI
      const welcomeMsg: Message = {
        id: "msg_welcome",
        role: "assistant",
        content: `Hello! I'm your RelocAI neighborhood advisor for ${initialCity}. Tell me about your ideal lifestyle, workplace commute, budget, or family and pet needs, and I'll find your best-fit areas!`,
        followup: "Looking for lively cafes, quiet residential pockets, or quick metro access?",
      };
      setMessages([welcomeMsg]);
    })();
  }, []);

  const handleSend = async (overrideText?: string) => {
    const textToSend = overrideText || inputText;
    if (!textToSend || !textToSend.trim() || loading) return;

    const userMessage: Message = {
      id: `user_${Date.now()}`,
      role: "user",
      content: textToSend.trim(),
    };

    setMessages((prev) => [...prev, userMessage]);
    if (!overrideText) setInputText("");
    setLoading(true);

    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId || undefined,
          message: textToSend.trim(),
          city,
        }),
      });

      const data = await response.json();

      if (data.success) {
        if (!sessionId && data.session_id) {
          setSessionId(data.session_id);
        }
        if (data.preferences) {
          setRunningPrefs(data.preferences);
        }

        const botMessage: Message = {
          id: `bot_${Date.now()}`,
          role: "assistant",
          content: data.message,
          recommendations: data.recommendations || [],
          followup: data.followup_question || null,
          preferences: data.preferences || {},
        };

        setMessages((prev) => [...prev, botMessage]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: `err_${Date.now()}`,
            role: "assistant",
            content: "Sorry, I encountered an issue retrieving recommendations. Please try again.",
          },
        ]);
      }
    } catch (err: any) {
      console.error("Chat error:", err);
      setMessages((prev) => [
        ...prev,
        {
          id: `err_${Date.now()}`,
          role: "assistant",
          content: `Unable to connect to RelocAI server (${err.message}). Make sure backend is running on port 5000.`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const renderRecommendationCard = (rec: any, index: number) => {
    const scorePct = Math.round((rec.score || 0.8) * 100);
    return (
      <View key={rec.locality_id || index} style={styles.recCard}>
        <View style={styles.recHeaderRow}>
          <Text style={styles.recTitle}>{rec.name}</Text>
          <View
            style={[
              styles.scoreBadge,
              { backgroundColor: scorePct >= 85 ? "#0F766E" : scorePct >= 70 ? "#0284C7" : "#D97706" },
            ]}
          >
            <Text style={styles.scoreBadgeText}>{scorePct}% Match</Text>
          </View>
        </View>

        {rec.locality?.rent_range && (
          <Text style={styles.recRent}>💰 {rec.locality.rent_range}</Text>
        )}

        {rec.commute_to_anchor && (
          <Text style={styles.recCommute}>
            🚗 {rec.commute_to_anchor.distance_km} km ({rec.commute_to_anchor.duration_text})
          </Text>
        )}

        <View style={styles.bulletSection}>
          <Text style={styles.bulletHeading}>Why it fits:</Text>
          {(rec.reasons || []).map((r: string, i: number) => (
            <Text key={i} style={styles.reasonText}>
              • {r}
            </Text>
          ))}
        </View>

        {rec.tradeoffs && rec.tradeoffs.length > 0 && (
          <View style={styles.tradeoffSection}>
            <Text style={styles.tradeoffHeading}>Keep in mind:</Text>
            {rec.tradeoffs.map((t: string, i: number) => (
              <Text key={i} style={styles.tradeoffText}>
                ⚠️ {t}
              </Text>
            ))}
          </View>
        )}
      </View>
    );
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isUser = item.role === "user";
    return (
      <View style={[styles.msgWrapper, isUser ? styles.userMsgWrapper : styles.botMsgWrapper]}>
        {!isUser && (
          <View style={styles.avatarCircle}>
            <Ionicons name="sparkles" size={14} color="#FFFFFF" />
          </View>
        )}

        <View style={{ flex: 1 }}>
          <View style={[styles.bubble, isUser ? styles.userBubble : styles.botBubble]}>
            <Text style={[styles.msgText, isUser ? styles.userMsgText : styles.botMsgText]}>
              {item.content}
            </Text>
          </View>

          {item.recommendations && item.recommendations.length > 0 && (
            <View style={styles.recListContainer}>
              <Text style={styles.recSectionHeader}>🎯 Top Grounded Neighborhoods:</Text>
              {item.recommendations.map((rec, idx) => renderRecommendationCard(rec, idx))}
            </View>
          )}

          {item.followup && (
            <TouchableOpacity
              style={styles.followupBubble}
              onPress={() => handleSend(item.followup || undefined)}
            >
              <Ionicons name="help-circle-outline" size={14} color="#0F766E" />
              <Text style={styles.followupText}>{item.followup}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
    >
      {/* Header bar */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color="#111827" />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.headerTitle}>RelocAI Advisor</Text>
          <Text style={styles.headerSubtitle}>Grounded RAG Neighborhood Intelligence</Text>
        </View>
        <View style={styles.onlineBadge}>
          <View style={styles.onlineDot} />
          <Text style={styles.onlineText}>Online</Text>
        </View>
      </View>

      {/* Running preferences chips */}
      {(runningPrefs.budget || runningPrefs.city || runningPrefs.pets || runningPrefs.lifestyle?.length > 0) && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.prefBar}
          contentContainerStyle={{ paddingHorizontal: 12, gap: 8 }}
        >
          {runningPrefs.city && (
            <View style={styles.prefChip}>
              <Text style={styles.prefChipText}>📍 {runningPrefs.city}</Text>
            </View>
          )}
          {runningPrefs.budget && (
            <View style={styles.prefChip}>
              <Text style={styles.prefChipText}>💰 {runningPrefs.budget}</Text>
            </View>
          )}
          {runningPrefs.pets && (
            <View style={styles.prefChip}>
              <Text style={styles.prefChipText}>🐕 Pet-Friendly</Text>
            </View>
          )}
          {(runningPrefs.lifestyle || []).map((l: string, i: number) => (
            <View key={i} style={styles.prefChip}>
              <Text style={styles.prefChipText}>✨ {l}</Text>
            </View>
          ))}
        </ScrollView>
      )}

      {/* Message list */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        contentContainerStyle={styles.listContent}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
      />

      {loading && (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color="#0F766E" />
          <Text style={styles.loadingText}>Retrieving neighborhoods and analyzing...</Text>
        </View>
      )}

      {/* Input row */}
      <View style={styles.inputContainer}>
        <TextInput
          placeholder="Ask e.g. 'Quiet area with parks under 40k'..."
          placeholderTextColor="#9CA3AF"
          value={inputText}
          onChangeText={setInputText}
          style={styles.inputField}
          onSubmitEditing={() => handleSend()}
          returnKeyType="send"
        />
        <TouchableOpacity
          style={[styles.sendButton, (!inputText.trim() || loading) && styles.sendButtonDisabled]}
          onPress={() => handleSend()}
          disabled={!inputText.trim() || loading}
        >
          <Ionicons name="send" size={18} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "ios" ? 50 : 20,
    paddingBottom: 14,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  backButton: {
    padding: 6,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#111827",
  },
  headerSubtitle: {
    fontSize: 12,
    color: "#6B7280",
  },
  onlineBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#10B981",
    marginRight: 4,
  },
  onlineText: {
    fontSize: 11,
    color: "#047857",
    fontWeight: "600",
  },
  prefBar: {
    backgroundColor: "#F3F4F6",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    maxHeight: 44,
  },
  prefChip: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  prefChipText: {
    fontSize: 12,
    color: "#374151",
    fontWeight: "500",
  },
  listContent: {
    padding: 16,
    paddingBottom: 24,
  },
  msgWrapper: {
    flexDirection: "row",
    marginBottom: 16,
    alignItems: "flex-start",
  },
  userMsgWrapper: {
    justifyContent: "flex-end",
  },
  botMsgWrapper: {
    justifyContent: "flex-start",
  },
  avatarCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#0F766E",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
    marginTop: 2,
  },
  bubble: {
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 12,
    maxWidth: "85%",
  },
  userBubble: {
    backgroundColor: "#0F766E",
    alignSelf: "flex-end",
    borderBottomRightRadius: 4,
  },
  botBubble: {
    backgroundColor: "#FFFFFF",
    alignSelf: "flex-start",
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  msgText: {
    fontSize: 14,
    lineHeight: 20,
  },
  userMsgText: {
    color: "#FFFFFF",
  },
  botMsgText: {
    color: "#1F2937",
  },
  recListContainer: {
    marginTop: 10,
    maxWidth: "92%",
  },
  recSectionHeader: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0F766E",
    marginBottom: 8,
  },
  recCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  recHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  recTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111827",
    flex: 1,
  },
  scoreBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  scoreBadgeText: {
    fontSize: 11,
    color: "#FFFFFF",
    fontWeight: "700",
  },
  recRent: {
    fontSize: 13,
    color: "#059669",
    fontWeight: "600",
    marginBottom: 4,
  },
  recCommute: {
    fontSize: 12,
    color: "#4B5563",
    marginBottom: 8,
  },
  bulletSection: {
    marginTop: 4,
  },
  bulletHeading: {
    fontSize: 12,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 2,
  },
  reasonText: {
    fontSize: 12,
    color: "#4B5563",
    lineHeight: 17,
  },
  tradeoffSection: {
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
  tradeoffHeading: {
    fontSize: 11,
    fontWeight: "600",
    color: "#D97706",
    marginBottom: 2,
  },
  tradeoffText: {
    fontSize: 12,
    color: "#6B7280",
    lineHeight: 16,
  },
  followupBubble: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F0FDFA",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#CCFBF1",
    alignSelf: "flex-start",
  },
  followupText: {
    fontSize: 12,
    color: "#0F766E",
    marginLeft: 6,
    fontWeight: "500",
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
  },
  loadingText: {
    marginLeft: 8,
    fontSize: 12,
    color: "#6B7280",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  inputField: {
    flex: 1,
    height: 44,
    backgroundColor: "#F3F4F6",
    borderRadius: 22,
    paddingHorizontal: 16,
    fontSize: 14,
    color: "#111827",
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#0F766E",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },
  sendButtonDisabled: {
    backgroundColor: "#9CA3AF",
  },
});
