import React from "react";
import { useNavigation } from "@react-navigation/native";
import { Image, Linking } from "react-native";
import { Box, Text, VStack, HStack, Center, ScrollView, Pressable } from "@gluestack-ui/themed";
import CommonHeader from "../../components/CommonHeader";
import { useTranslation } from "../../hooks/useTranslation";
import { LAYOUT } from "../../constants/layout";
import { useAppSelector } from "../../store/hooks";
import { PhoneCallIcon, WhatsAppIcon } from "../../components/icons/ContactIcons";
import { buildSupportWhatsAppUrl } from "../../utils/supportContact";
import { getAppVersion } from "../../utils/appVersion";

const AboutUsScreen = () => {
  const navigation = useNavigation();
  const { t } = useTranslation();
  const { supportPhone, supportWhatsapp } = useAppSelector(s => s.config);
  const shopDetails = useAppSelector(s => s.data.shopDetails);

  const features = t<string[]>("about.features") ?? [];
  // Read from the installed binary, so a version bump for a release shows up
  // here without anyone remembering to edit a string.
  const appVersion = getAppVersion();

  return (
    <Box flex={1} bg="$coolGray50">
      <CommonHeader
        title={t("about.headerTitle")}
        variant="light"
        showBack
        onPressBack={() => navigation.goBack()}
      />

      <ScrollView
        flex={1}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ 
          padding: 24, 
          paddingBottom: 100,
          ...(LAYOUT.isWeb ? LAYOUT.contentContainerStyle : {})
        }}
      >
        <VStack space="md">
          <Box
            bg="$white"
            rounded="$xl"
            p="$6"
            borderWidth={1}
            borderColor="$coolGray200"
          >
            <Center>
              <Box w={80} h={80} rounded="$xl" overflow="hidden">
                <Image
                  source={require('../../../assets/logo.png')}
                  style={{ width: 80, height: 80, borderRadius: 16 }}
                  resizeMode="cover"
                />
              </Box>

              <Text mt="$4" fontSize="$2xl" fontWeight="$bold" color="$black">
                {t("about.appName")}
              </Text>
              {!!appVersion && (
                <Text mt="$1" fontSize="$sm" color="$coolGray500">
                  {`${t("about.version")} ${appVersion}`}
                </Text>
              )}
            </Center>
          </Box>

          {/* Contact — call & WhatsApp */}
          <Box
            bg="$white"
            rounded="$xl"
            p="$4"
            borderWidth={1}
            borderColor="$coolGray200"
          >
            <Text fontWeight="$bold" fontSize="$lg" color="$black" mb="$3">
              {t("about.contactTitle") || "Contact Us"}
            </Text>
            <HStack space="lg">
              <Pressable
                flex={1}
                bg="$coolGray50"
                rounded="$xl"
                p="$3"
                borderWidth={1}
                borderColor="$coolGray100"
                onPress={() => Linking.openURL(`tel:${supportPhone}`)}
              >
                <HStack space="sm" alignItems="center" justifyContent="center">
                  <PhoneCallIcon size={24} />
                  <Text fontWeight="$medium" color="$coolGray900">
                    {t("about.call") || "Call"}
                  </Text>
                </HStack>
              </Pressable>

              <Pressable
                flex={1}
                bg="$coolGray50"
                rounded="$xl"
                p="$3"
                borderWidth={1}
                borderColor="$coolGray100"
                onPress={() => Linking.openURL(buildSupportWhatsAppUrl(supportWhatsapp, shopDetails))}
              >
                <HStack space="sm" alignItems="center" justifyContent="center">
                  <WhatsAppIcon size={24} />
                  <Text fontWeight="$medium" color="$coolGray900">
                    {t("about.whatsapp") || "WhatsApp"}
                  </Text>
                </HStack>
              </Pressable>
            </HStack>
          </Box>

          <Box
            bg="$white"
            rounded="$xl"
            p="$4"
            borderWidth={1}
            borderColor="$coolGray200"
          >
            <Text fontWeight="$bold" fontSize="$lg" color="$black">
              {t("about.aboutTitle")}
            </Text>
            <Text color="$coolGray600" mt="$3" lineHeight="$lg">
              {t("about.aboutDescription")}
            </Text>
          </Box>

          <Box
            bg="$white"
            rounded="$xl"
            p="$4"
            borderWidth={1}
            borderColor="$coolGray200"
          >
            <Text fontWeight="$bold" fontSize="$lg" color="$black">
              {t("about.featuresTitle")}
            </Text>

            <VStack mt="$4" space="sm">
              {features.map((item, index) => (
                <Text key={index} color="$coolGray600">
                  • {item}
                </Text>
              ))}
            </VStack>
          </Box>

          <Center mt="$6">
            <Text color="$coolGray500" textAlign="center" fontSize="$sm">
              {t("about.footerLine1")}
            </Text>
            <Text color="$coolGray400" textAlign="center" fontSize="$xs" mt="$1">
              {`© ${new Date().getFullYear()} ${t("about.footerLine2")}`}
            </Text>
          </Center>
        </VStack>
      </ScrollView>
    </Box>
  );
};

export default AboutUsScreen;
