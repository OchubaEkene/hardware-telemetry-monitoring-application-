import { MaterialIcons } from "@expo/vector-icons";
import React, { useRef, useState, useEffect } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { openai } from "@ai-sdk/openai";
import { telemetryDB } from "@/lib/db";

// Import AI SDK directly
const { generateText } = require("ai");


export default function HardwareAnalyticsScreen() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<{id: string, role: 'user' | 'assistant', content: string}[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const [isScrolling, setIsScrolling] = useState(false);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const insets = useSafeAreaInsets();

  // Debug render count
  console.log('🔄 Component render - messages:', messages.length, 'isLoading:', isLoading);

  // Auto-scroll to bottom when new messages arrive (only if user is near bottom)
  const scrollToBottom = () => {
    if (scrollViewRef.current && !isScrolling) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  };

  // Removed aggressive auto-scroll - now only scrolls when user sends message

  // Simple text formatting without spacing issues
  const formatAIResponse = (content: string) => {
    // Just return clean text with basic markdown processing
    const cleanText = content.replace(/\*\*/g, '');
    return (
      <Text style={styles.messageText}>
        {cleanText}
      </Text>
    );
  };

  const handleSubmit = async () => {
    console.log('🔥 handleSubmit called!', { input: input.trim(), isLoading });
    if (!input.trim() || isLoading) {
      console.log('❌ Early return:', { hasInput: !!input.trim(), isLoading });
      return;
    }
    
    console.log('🚀 Starting chat request...');
    const userMessage = { id: Date.now().toString(), role: 'user' as const, content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput("");
    
    // Auto-scroll to bottom when user sends a message
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
    console.log('📝 Setting loading to true...');
    setIsLoading(true);
    
    try {
      console.log('🔑 Using API key from environment...');

      console.log('🤖 Calling generateText...');
      
      // Add timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Request timeout after 30 seconds')), 30000);
      });
      
      // Get telemetry data first and inject it directly into the prompt
      await telemetryDB.init();
      const telemetryData = await telemetryDB.getTelemetrySince(3600);
      const anomalies = await telemetryDB.detectAnomalies(3600);
      
      // Get the latest readings
      const latestData = telemetryData[telemetryData.length - 1] || {};
      const avgGpuTemp = telemetryData.length > 0 ? telemetryData.reduce((sum, d) => sum + d.gpu_temp, 0) / telemetryData.length : 0;
      const avgCpuTemp = telemetryData.length > 0 ? telemetryData.reduce((sum, d) => sum + d.cpu_temp, 0) / telemetryData.length : 0;
      const avgPowerDraw = telemetryData.length > 0 ? telemetryData.reduce((sum, d) => sum + d.power_draw, 0) / telemetryData.length : 0;
      
      // Format recent data for analysis
      const recentData = telemetryData.slice(-5).map(entry => ({
        time: new Date(entry.timestamp * 1000).toLocaleTimeString(),
        gpu_temp: entry.gpu_temp,
        cpu_temp: entry.cpu_temp,
        fan_rpm: entry.fan_rpm,
        power_draw: entry.power_draw,
      }));

      // AI CALL - Direct data injection approach (more reliable)
      const generateTextPromise = generateText({
        model: openai("gpt-4o"),
        system: `You are a hardware telemetry analysis assistant. You will receive specific hardware data in the user message. You MUST analyze this exact data and provide detailed technical insights.

CRITICAL INSTRUCTIONS:
1. ALWAYS reference the EXACT temperature values provided (e.g., "64.7°C", "66.2°C")
2. ALWAYS mention the EXACT power readings provided (e.g., "118.1W", "127.9W")
3. ALWAYS reference the EXACT fan speeds provided (e.g., "1597 RPM", "1244 RPM")
4. ALWAYS mention anomaly counts if provided
5. Provide technical analysis based on these specific values
6. Give actionable recommendations based on the actual data

EXAMPLE RESPONSE FORMAT:
"Based on your current hardware data:

GPU Temperature: 64.7°C - This is excellent and well within the safe operating range of 60-80°C.
CPU Temperature: 66.2°C - Also optimal, showing good thermal management.
Fan Speed: 1597 RPM - Indicates active cooling performance.
Power Draw: 118.1W - Shows moderate system load.

Your system is running very efficiently with no thermal concerns. The temperatures are well within safe limits and the cooling system is performing optimally."

NEVER give generic responses. ALWAYS use the specific data values provided in the user message.`,
        messages: [
          { 
            role: 'user', 
            content: `Question: ${input}

IMPORTANT: Analyze the EXACT hardware data below and reference the specific values in your response.

CURRENT HARDWARE DATA:
- Latest GPU Temperature: ${latestData.gpu_temp?.toFixed(1)}°C
- Latest CPU Temperature: ${latestData.cpu_temp?.toFixed(1)}°C  
- Latest Fan RPM: ${latestData.fan_rpm?.toFixed(0)} RPM
- Latest Power Draw: ${latestData.power_draw?.toFixed(1)}W
- Average GPU Temperature (1 hour): ${avgGpuTemp.toFixed(1)}°C
- Average CPU Temperature (1 hour): ${avgCpuTemp.toFixed(1)}°C
- Average Power Draw (1 hour): ${avgPowerDraw.toFixed(1)}W
- Total Anomalies Detected: ${anomalies.gpuAnomalies.length + anomalies.cpuAnomalies.length + anomalies.powerAnomalies.length}
- GPU Anomalies: ${anomalies.gpuAnomalies.length}
- CPU Anomalies: ${anomalies.cpuAnomalies.length}
- Power Anomalies: ${anomalies.powerAnomalies.length}

RECENT READINGS (Last 5 entries):
${recentData.map(d => `- ${d.time}: GPU ${d.gpu_temp.toFixed(1)}°C, CPU ${d.cpu_temp.toFixed(1)}°C, Fan ${d.fan_rpm.toFixed(0)} RPM, Power ${d.power_draw.toFixed(1)}W`).join('\n')}

REQUIRED: Use the EXACT values above (like ${latestData.gpu_temp?.toFixed(1)}°C, ${latestData.cpu_temp?.toFixed(1)}°C, ${latestData.fan_rpm?.toFixed(0)} RPM, ${latestData.power_draw?.toFixed(1)}W) in your analysis. Do not give generic responses.` 
          }
        ],
        maxTokens: 1000,
      });

      console.log('⏰ Waiting for response with timeout...');
      const result = await Promise.race([generateTextPromise, timeoutPromise]);

      console.log('✅ Got response:', result.text?.substring(0, 100) + '...');
      console.log('✅ Full response text:', result.text);
      console.log('✅ Response length:', result.text?.length);
      
      // Handle response
      let responseText = result.text;
      
      // Final fallback if still empty
      if (!responseText || responseText.trim() === '') {
        responseText = `I received your question: "${input}". This is a test response from the hardware monitoring AI. The AI system is working but returned an empty response.`;
        console.log('⚠️ Using fallback response');
      }
      
      const assistantMessage = { 
        id: (Date.now() + 1).toString(), 
        role: 'assistant' as const, 
        content: responseText
      };
      console.log('💬 Adding assistant message:', assistantMessage.content?.substring(0, 50) + '...');
      setMessages(prev => {
        const newMessages = [...prev, assistantMessage];
        console.log('📋 Total messages now:', newMessages.length);
        return newMessages;
      });
    } catch (error) {
      console.error('❌ Chat error:', error);
      const errorObj = error as Error;
      console.error('❌ Error details:', {
        message: errorObj.message,
        name: errorObj.name,
        stack: errorObj.stack?.substring(0, 200)
      });
      
      const errorMessage = { 
        id: (Date.now() + 1).toString(), 
        role: 'assistant' as const, 
        content: `Sorry, I encountered an error: ${errorObj.message}. Please try again.` 
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      console.log('🏁 Setting loading to false...');
      setIsLoading(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
      >
        <View style={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerContent}>
              <View style={styles.headerIcon}>
                <MaterialIcons name="psychology" size={28} color="#6366f1" />
              </View>
              <View style={styles.headerText}>
                <Text style={styles.headerTitle}>Hardware Analytics</Text>
                <Text style={styles.headerSubtitle}>AI-Powered Performance Insights</Text>
              </View>
            </View>
            <View style={styles.statusIndicator}>
              <View style={[styles.statusDot, { backgroundColor: '#10b981' }]} />
              <Text style={styles.statusText}>Online</Text>
            </View>
          </View>

          {/* Messages Container */}
          <ScrollView
            ref={scrollViewRef}
            style={styles.messagesContainer}
            contentContainerStyle={styles.messagesContent}
            showsVerticalScrollIndicator={true}
            onScrollBeginDrag={() => setIsScrolling(true)}
            onScrollEndDrag={() => setIsScrolling(false)}
            onMomentumScrollEnd={() => setIsScrolling(false)}
            onScroll={(event) => {
              const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
              const isNearBottom = contentOffset.y + layoutMeasurement.height >= contentSize.height - 100;
              setShowScrollButton(!isNearBottom && messages.length > 0);
            }}
            keyboardShouldPersistTaps="handled"
          >
            {messages.length === 0 ? (
              <View style={styles.emptyState}>
                <View style={styles.emptyIcon}>
                  <MaterialIcons name="monitor" size={64} color="#6366f1" />
                </View>
                <Text style={styles.emptyTitle}>Welcome to Hardware Analytics</Text>
                <Text style={styles.emptySubtitle}>
                  Ask me about your system performance, temperatures, power consumption, or any hardware concerns.
                </Text>
                <View style={styles.suggestionChips}>
                  <TouchableOpacity 
                    style={styles.chip}
                    onPress={() => setInput("What's my current GPU temperature?")}
                  >
                    <Text style={styles.chipText}>What's my current GPU temperature?</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={styles.chip}
                    onPress={() => setInput("Analyze my system performance")}
                  >
                    <Text style={styles.chipText}>Analyze my system performance</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={styles.chip}
                    onPress={() => setInput("Check for any anomalies")}
                  >
                    <Text style={styles.chipText}>Check for any anomalies</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              messages.map((message, index) => (
                  <View key={message.id} style={styles.messageContainer}>
                    <View style={[
                      styles.messageBubble,
                      message.role === 'user' ? styles.userMessage : styles.assistantMessage
                    ]}>
                      <View style={styles.messageHeader}>
                        <View style={styles.messageAvatar}>
                          {message.role === 'user' ? (
                            <MaterialIcons name="person" size={20} color="#6366f1" />
                          ) : (
                            <MaterialIcons name="psychology" size={20} color="#10b981" />
                          )}
                        </View>
                        <Text style={styles.messageRole}>
                          {message.role === 'user' ? 'You' : 'Hardware AI'}
                        </Text>
                        <Text style={styles.messageTime}>
                          {new Date().toLocaleTimeString()}
                        </Text>
                      </View>
                    <Text style={[
                      styles.messageText,
                      message.role === 'user' ? styles.userMessageText : styles.assistantMessageText
                    ]}>
                      {message.content.replace(/\*\*/g, '')}
                    </Text>
                    </View>
                  </View>
                ))
            )}
            
            {isLoading && (
              <View style={styles.loadingContainer}>
                <View style={styles.loadingBubble}>
                  <View style={styles.loadingHeader}>
                    <View style={styles.loadingAvatar}>
                      <MaterialIcons name="psychology" size={20} color="#10b981" />
                    </View>
                    <Text style={styles.loadingRole}>Hardware AI</Text>
                  </View>
                  <View style={styles.loadingContent}>
                    <ActivityIndicator size="small" color="#6366f1" />
                    <Text style={styles.loadingText}>Analyzing hardware data...</Text>
                  </View>
                </View>
              </View>
            )}
          </ScrollView>

          {/* Scroll to Bottom Button */}
          {showScrollButton && (
            <TouchableOpacity
              style={styles.scrollToBottomButton}
              onPress={() => {
                scrollViewRef.current?.scrollToEnd({ animated: true });
                setShowScrollButton(false);
              }}
            >
              <MaterialIcons name="keyboard-arrow-down" size={24} color="white" />
            </TouchableOpacity>
          )}

          {/* Input Container */}
          <View style={styles.inputContainer}>
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.textInput}
                value={input}
                onChangeText={setInput}
                placeholder="Ask about hardware performance..."
                placeholderTextColor="#9ca3af"
                multiline
                maxLength={1000}
              />
              <TouchableOpacity
                style={[
                  styles.sendButton,
                  (!input.trim() || isLoading) && styles.sendButtonDisabled,
                ]}
                onPress={() => {
                  console.log('🎯 Button pressed!', { 
                    input: input.trim(), 
                    inputLength: input.length,
                    isLoading,
                    messagesCount: messages.length 
                  });
                  handleSubmit();
                }}
                disabled={!input.trim() || isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <MaterialIcons
                    name="send"
                    size={24}
                    color={!input.trim() ? "#9ca3af" : "white"}
                  />
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f172a",
  },
  content: {
    flex: 1,
  },
  keyboardAvoid: {
    flex: 1,
  },
  
  // Header Styles
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: "#1e293b",
    borderBottomWidth: 1,
    borderBottomColor: "#334155",
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  headerIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#1e293b",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    borderWidth: 2,
    borderColor: "#6366f1",
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#f8fafc",
    marginBottom: 2,
  },
  headerSubtitle: {
    fontSize: 14,
    color: "#94a3b8",
    fontWeight: "500",
  },
  statusIndicator: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1e293b",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#334155",
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    color: "#10b981",
    fontWeight: "600",
  },

  // Messages Styles
  messagesContainer: {
    flex: 1,
    backgroundColor: "#0f172a",
  },
  messagesContent: {
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  
  // Empty State
  emptyState: {
    alignItems: "center",
    paddingTop: 60,
    paddingHorizontal: 24,
  },
  emptyIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "#1e293b",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
    borderWidth: 2,
    borderColor: "#334155",
  },
  emptyTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: "#f8fafc",
    textAlign: "center",
    marginBottom: 12,
  },
  emptySubtitle: {
    fontSize: 16,
    color: "#94a3b8",
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 32,
  },
  suggestionChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 12,
  },
  chip: {
    backgroundColor: "#1e293b",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#334155",
  },
  chipText: {
    fontSize: 14,
    color: "#6366f1",
    fontWeight: "500",
  },

  // Message Styles
  messageContainer: {
    marginBottom: 20,
  },
  messageBubble: {
    maxWidth: "85%",
    borderRadius: 20,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  userMessage: {
    alignSelf: "flex-end",
    backgroundColor: "#6366f1",
    borderBottomRightRadius: 6,
  },
  assistantMessage: {
    alignSelf: "flex-start",
    backgroundColor: "#1e293b",
    borderBottomLeftRadius: 6,
    borderWidth: 1,
    borderColor: "#334155",
  },
  messageHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 2,
  },
  messageAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  messageRole: {
    fontSize: 12,
    fontWeight: "600",
    color: "#94a3b8",
    flex: 1,
  },
  messageTime: {
    fontSize: 11,
    color: "#64748b",
  },
  messageText: {
    fontSize: 16,
    lineHeight: 24,
  },
  userMessageText: {
    color: "#ffffff",
  },
  assistantMessageText: {
    color: "#f8fafc",
  },

  // Simple text formatting styles
  boldText: {
    fontWeight: "700",
    color: "#f8fafc",
  },

  // Loading Styles
  loadingContainer: {
    marginBottom: 20,
  },
  loadingBubble: {
    alignSelf: "flex-start",
    backgroundColor: "#1e293b",
    borderRadius: 20,
    padding: 16,
    borderBottomLeftRadius: 6,
    borderWidth: 1,
    borderColor: "#334155",
    maxWidth: "85%",
  },
  loadingHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 2,
  },
  loadingAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(16,185,129,0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  loadingRole: {
    fontSize: 12,
    fontWeight: "600",
    color: "#94a3b8",
  },
  loadingContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  loadingText: {
    fontSize: 14,
    color: "#94a3b8",
    marginLeft: 8,
    fontStyle: "italic",
  },

  // Input Styles
  inputContainer: {
    backgroundColor: "#1e293b",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: "#334155",
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "flex-end",
    backgroundColor: "#0f172a",
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "#334155",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    color: "#f8fafc",
    maxHeight: 100,
    paddingVertical: 4,
    lineHeight: 20,
  },
  sendButton: {
    backgroundColor: "#6366f1",
    borderRadius: 20,
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
    shadowColor: "#6366f1",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 2,
  },
  sendButtonDisabled: {
    backgroundColor: "#334155",
    shadowOpacity: 0,
  },
  
  // Scroll to Bottom Button
  scrollToBottomButton: {
    position: "absolute",
    bottom: 100,
    right: 20,
    backgroundColor: "#6366f1",
    borderRadius: 25,
    width: 50,
    height: 50,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
});