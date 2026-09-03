import React, { useState, useEffect } from "react";
import { useNavigation } from "@react-navigation/native";
import {
  Box,
  Input,
  InputField,
  Text,
  VStack,
  ScrollView,
} from "@gluestack-ui/themed";
import CommonHeader from "../../components/CommonHeader";
import { HELP_TOPICS } from "../../tutorials/catalog";
import GradientButton from "../../components/GradientButton";
import { useTranslation } from "../../hooks/useTranslation";
import { LAYOUT } from "../../constants/layout";
import { INPUT_LIMITS } from "../../constants/inputLimits";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import { fetchShopDetails, updateShopDetails, clearUserData } from "../../store/data/dataSlice";
import { endImpersonation } from "../../store/auth/authSlice";
import { Platform, KeyboardAvoidingView } from "react-native";
import { toast } from "../../components/common/Toast";
import ImpersonationBlockModal from "../../components/ImpersonationBlockModal";

const GstScreen = () => {
  const navigation = useNavigation();
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const { shopDetails } = useAppSelector((s) => s.data);
  const { impersonateUserId, impersonatePhone } = useAppSelector(s => s.auth);
  const [blockModalVisible, setBlockModalVisible] = useState(false);

  const handleEndSession = () => {
    dispatch(endImpersonation());
    dispatch(clearUserData());
    (navigation as any).navigate('AdminDashboard');
  };

  const [gstRate, setGstRate] = useState("3");

  useEffect(() => {
    dispatch(fetchShopDetails());
  }, []);

  useEffect(() => {
    if (shopDetails) {
      setGstRate(String(shopDetails.gstPercentage || "3"));
    }
  }, [shopDetails]);

  const handleSave = async () => {
    if (impersonateUserId) { setBlockModalVisible(true); return; }
    if (!shopDetails) {
      toast.error(t("gst.alerts.shopNotFound"));
      return;
    }

    try {
      const payload = {
        ...shopDetails,
        gstPercentage: parseFloat(gstRate) || 0
      };

      console.log("[GstScreen] Saving GST settings:", payload.gstPercentage);

      await dispatch(updateShopDetails(payload)).unwrap();
      toast.success(t("gst.alerts.updateSuccess"));
      navigation.goBack();
    } catch (err: any) {
      console.error("[GstScreen] Save error:", err);
      toast.error(err || t("gst.alerts.updateFailed"));
    }
  };

  return (
    <Box flex={1} bg="$coolGray50">
      <CommonHeader
        title={t("gst.headerTitle")}
        subtitle={t("gst.headerSubtitle")}
        variant="light"
        showBack
        onPressBack={() => navigation.goBack()}
        helpTopic={HELP_TOPICS.gst}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          flex={1}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            padding: 16,
            paddingBottom: 24,
            ...(LAYOUT.isWeb ? LAYOUT.contentContainerStyle : {})
          }}
        >
          <Box
            bg="$white"
            rounded="$2xl"
            borderWidth={1}
            borderColor="$coolGray100"
            hardShadow="1"
            style={{ padding: 16 }}
          >
            <VStack style={{ gap: 18 }}>
              <Box>
                <Text fontWeight="$bold" color="$coolGray900" style={{ fontSize: 16 }}>
                  {t("gst.label") || "GST Percentage (%)"}
                </Text>
                <Input mt="$3" bg="$coolGray50" rounded="$xl" borderWidth={1} borderColor="#E5E7EB">
                  <InputField keyboardType="numeric" value={gstRate} onChangeText={setGstRate} maxLength={INPUT_LIMITS.percentage} />
                </Input>
              </Box>
            </VStack>
          </Box>

          <Box mt="$6" rounded="$2xl" bg="$coolGray100" borderWidth={1} borderColor="$coolGray200" style={{ padding: 16 }}>
            <Text fontWeight="$bold" color="$coolGray900" style={{ fontSize: 18 }}>
              {t("gst.noteTitle")}
            </Text>
            <Text mt="$3" color="$coolGray600" style={{ fontSize: 15 }}>
              {t("gst.noteDescription")}
            </Text>
          </Box>

          <Box mt="$6">
            <GradientButton
              label={t("gst.saveBtn")}
              onPress={handleSave}
            />
          </Box>
        </ScrollView>
      </KeyboardAvoidingView>
      <ImpersonationBlockModal
        isOpen={blockModalVisible}
        phone={impersonatePhone || ''}
        onEndSession={handleEndSession}
        onClose={() => setBlockModalVisible(false)}
      />
    </Box>
  );
};

export default GstScreen;
