import React from "react";
import { useNavigation } from "@react-navigation/native";
import { Linking } from "react-native";
import {
  Box,
  Text,
  VStack,
  HStack,
  ScrollView,
  Pressable,
  Icon,
  Center,
} from "@gluestack-ui/themed";
import CommonHeader from "../../components/CommonHeader";
import { Mail, Phone, MapPin, ExternalLink } from "lucide-react-native";
import Svg, { Defs, LinearGradient, Stop, Rect } from "react-native-svg";
import { useTranslation } from "../../hooks/useTranslation";
import { LAYOUT } from "../../constants/layout";
import { useAppSelector } from "../../store/hooks";
import { WhatsAppIcon } from "../../components/icons/ContactIcons";
import { buildSupportWhatsAppUrl } from "../../utils/supportContact";

const ContactScreen = () => {
  const navigation = useNavigation();
  const { t } = useTranslation();
  const { supportEmail, supportPhone, supportWhatsapp, supportAddress } = useAppSelector(s => s.config);
  const shopDetails = useAppSelector(s => s.data.shopDetails);

  const GradientTile = ({
    children,
    colors,
    id,
  }: {
    children: React.ReactNode;
    colors: [string, string];
    id: string;
  }) => (
    <Box w={54} h={54} rounded="$2xl" overflow="hidden" position="relative">
      <Svg height="100%" width="100%" style={{ position: "absolute" }}>
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={colors[0]} />
            <Stop offset="1" stopColor={colors[1]} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
      <Center flex={1}>{children}</Center>
    </Box>
  );

  const ContactRow = ({
    title,
    value,
    icon,
    customIcon,
    colors,
    gid,
    onPress,
  }: {
    title: string;
    value: string;
    icon?: any;
    customIcon?: React.ReactNode;
    colors: [string, string];
    gid: string;
    onPress?: () => void;
  }) => (
    <Pressable
      bg="$white"
      rounded="$2xl"
      p="$3"
      hardShadow="1"
      borderWidth={1}
      borderColor="$coolGray100"
      onPress={onPress}
    >
      <HStack space="md" alignItems="center">
        <GradientTile colors={colors} id={gid}>
          {customIcon ?? <Icon as={icon} size="lg" color="$white" />}
        </GradientTile>

        <VStack flex={1} space="xs">
          <Text fontWeight="$bold" fontSize="$md" color="$coolGray900">
            {title}
          </Text>
          <Text color="$coolGray600" fontSize="$sm">
            {value}
          </Text>
        </VStack>

        <Box p="$2" rounded="$lg">
          <Icon as={ExternalLink} size="md" color="$coolGray500" />
        </Box>
      </HStack>
    </Pressable>
  );

  return (
    <Box flex={1} bg="$coolGray50">
      <CommonHeader
        title={t("contact.headerTitle")}
        variant="light"
        showBack
        onPressBack={() => navigation.goBack()}
      />

      <ScrollView
        flex={1}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ 
          padding: 16, 
          paddingBottom: 22,
          ...(LAYOUT.isWeb ? LAYOUT.contentContainerStyle : {})
        }}
      >
        <VStack space="md">

          {/* Intro Card */}
          <Box
            bg="$white"
            rounded="$2xl"
            p="$4"
            hardShadow="1"
            borderWidth={1}
            borderColor="$coolGray100"
          >
            <Text
              fontWeight="$bold"
              fontSize="$xl"
              color="$coolGray900"
              textAlign="center"
            >
              {t("contact.introTitle")}
            </Text>

            <Text
              mt="$2"
              color="$coolGray500"
              fontSize="$sm"
              textAlign="center"
            >
              {t("contact.introSubtitle")}
            </Text>
          </Box>

          <ContactRow
            title={t("contact.email")}
            value={supportEmail}
            icon={Mail}
            colors={["#6366F1", "#D946EF"]}
            gid="emailGrad"
            onPress={() => Linking.openURL(`mailto:${supportEmail}`)}
          />

          <ContactRow
            title={t("contact.phone")}
            value={supportPhone}
            icon={Phone}
            colors={["#2DD4BF", "#10B981"]}
            gid="phoneGrad"
            onPress={() => Linking.openURL(`tel:${supportPhone}`)}
          />

          <ContactRow
            title={t("contact.whatsapp") || "WhatsApp Support"}
            value={supportWhatsapp}
            customIcon={<WhatsAppIcon size={34} />}
            colors={["#25D366", "#128C7E"]}
            gid="whatsappGrad"
            onPress={() => Linking.openURL(buildSupportWhatsAppUrl(supportWhatsapp, shopDetails))}
          />

          <ContactRow
            title={t("contact.address")}
            value={supportAddress}
            icon={MapPin}
            colors={["#FB7185", "#F97316"]}
            gid="addrGrad"
            onPress={() => Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(supportAddress)}`)}
          />

          {/* Business Hours */}
          <Box
            bg="$coolGray100"
            rounded="$2xl"
            p="$4"
            borderWidth={1}
            borderColor="$coolGray200"
          >
            <Text fontWeight="$bold" fontSize="$lg" color="$coolGray900">
              {t("contact.businessHoursTitle")}
            </Text>

            <VStack mt="$2" space="xs">
              <Text color="$coolGray700" fontSize="$sm">
                {t("contact.hours.weekday")}
              </Text>
              <Text color="$coolGray700" fontSize="$sm">
                {t("contact.hours.sunday")}
              </Text>
            </VStack>
          </Box>
        </VStack>
      </ScrollView>
    </Box>
  );
};

export default ContactScreen;
