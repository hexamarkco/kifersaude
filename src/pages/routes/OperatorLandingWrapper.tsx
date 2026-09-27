import { getOperatorLandingByPath, OperatorLandingScreen } from '../../features/operator-landings';

import { useParams } from 'react-router-dom';

export default function OperatorLandingWrapper() {
  const { slug, variant } = useParams();
  return <OperatorLandingScreen page={getOperatorLandingByPath(slug, variant)} />;
}
