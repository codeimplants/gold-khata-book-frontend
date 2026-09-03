import { useAppSelector } from '../store/hooks';
import {
  resolveFeatureFlag,
  type FeatureFlagKey,
} from '../featureFlags/registry';

/**
 * Whether a feature is switched on for this install.
 *
 * A pure selector over both layers — the product's own flags from
 * `/api/platform/config` and the force-off flags from Nexus. Nothing is fetched
 * here: both arrive during the launch sequence that already runs, so reading a
 * flag costs nothing and can be done from any screen.
 *
 * Resolves to the compiled default while the config request is still in flight,
 * which for every flag defined so far means the feature is briefly visible before
 * a remote "off" applies. That is the correct trade: the alternative is hiding
 * working features for a second on every cold start, and permanently on any
 * launch where the config request fails.
 */
export const useFeatureFlag = (key: FeatureFlagKey): boolean => {
  const productFlags = useAppSelector(s => s.config.featureFlags);
  const nexusFlags = useAppSelector(s => s.config.nexusFeatureFlags);
  return resolveFeatureFlag(key, productFlags, nexusFlags);
};
