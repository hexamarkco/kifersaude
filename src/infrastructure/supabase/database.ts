import type { Database as DeployedDatabase } from './database.generated';
import type { ContractProductionFields, ProductionFunctions, ProductionTables } from './production.generated';

type Contracts = DeployedDatabase['public']['Tables']['contracts'];
// Additive migration types are generated locally until the authorized remote rollout.
export type Database = Omit<DeployedDatabase, 'public'> & {
  public: Omit<DeployedDatabase['public'], 'Tables' | 'Functions'> & {
    Tables: Omit<DeployedDatabase['public']['Tables'], 'contracts'> & ProductionTables & {
      contracts: Omit<Contracts, 'Row' | 'Insert' | 'Update'> & {
        Row: Contracts['Row'] & Required<ContractProductionFields>;
        Insert: Contracts['Insert'] & ContractProductionFields;
        Update: Contracts['Update'] & ContractProductionFields;
      };
    };
    Functions: DeployedDatabase['public']['Functions'] & ProductionFunctions;
  };
};
