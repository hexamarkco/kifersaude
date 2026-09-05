-- APPLY: Move 358 Perdido leads to Reativação
-- Dry run: be2026df-c146-4a78-aa85-cf167580f500
-- Strategy: transactional skip_automation protection

BEGIN;

-- 1. Materialize the 358 approved leads
CREATE TEMPORARY TABLE _apply_targets (
  lead_id uuid PRIMARY KEY,
  reason_code text NOT NULL,
  original_skip boolean NOT NULL
) ON COMMIT DROP;

INSERT INTO _apply_targets (lead_id, reason_code, original_skip) VALUES
    ('200c89c3-2f50-49da-9889-959f03242760'::uuid, 'SUMIU_APOS_COTACAO', false),
    ('0e8cfa33-553e-4425-8a2c-8f1e63a4ea28'::uuid, 'NUNCA_ENGAJOU', false),
    ('43e63867-c05d-484b-ac39-67c797588b71'::uuid, 'NUNCA_ENGAJOU', false),
    ('5a3d2902-0c8c-4cf5-86db-0f64d09cc244'::uuid, 'SUMIU_APOS_COTACAO', false),
    ('388a0657-bb4a-447d-8ce1-dfe5273162f5'::uuid, 'SUMIU_APOS_COTACAO', false),
    ('43aea851-d3f9-4175-8f64-eada41148a93'::uuid, 'SUMIU_APOS_COTACAO', false),
    ('ec49f546-ed0e-497c-aac3-4ea342453d5b'::uuid, 'SUMIU_APOS_COTACAO', false),
    ('0bb13a44-888c-4fe2-9567-56d62938d831'::uuid, 'SUMIU_APOS_COTACAO', false),
    ('81f0ac20-4bfb-4bb7-94cc-86c960483c41'::uuid, 'SUMIU_APOS_COTACAO', false),
    ('42708c59-de2a-421d-b541-94ef16b3fde3'::uuid, 'SUMIU_APOS_COTACAO', false),
    ('9a0747a2-b22d-4584-9eae-7ea034a04901'::uuid, 'NUNCA_ENGAJOU', false),
    ('03984f94-7404-4f9e-b285-504c38cbdc93'::uuid, 'NUNCA_ENGAJOU', false),
    ('61061ad6-621a-48fe-a598-e44f5ffbf5a9'::uuid, 'NUNCA_ENGAJOU', false),
    ('f521593c-452d-4887-b07c-f27f4b007846'::uuid, 'SUMIU_APOS_COTACAO', false),
    ('4c9fb2f2-780e-4f8c-bfd5-35a957250e36'::uuid, 'SUMIU_APOS_COTACAO', false),
    ('70162eda-5269-4c3d-b7c2-207dfa263ff8'::uuid, 'SUMIU_APOS_COTACAO', false),
    ('28769914-4bb5-4f93-8203-8820ea82b50e'::uuid, 'ATENDIMENTO_INTERROMPIDO', false),
    ('a6c9925d-5ba5-4a18-82f7-03f42cec4be2'::uuid, 'NUNCA_ENGAJOU', false),
    ('98197be5-2803-4961-8cd5-254b7fa12d2c'::uuid, 'SUMIU_APOS_COTACAO', false),
    ('4afde467-7799-4082-bb15-8c4e8f466868'::uuid, 'SUMIU_APOS_COTACAO', false),
    ('0ddbfb1c-2925-406a-944c-6e1ec3bd12f5'::uuid, 'NUNCA_ENGAJOU', false),
    ('e9a4982d-15d5-4ee0-a29e-e95214552f68'::uuid, 'NUNCA_ENGAJOU', false),
    ('400c91e6-6eb2-417f-b9c7-dd981fcb3459'::uuid, 'NUNCA_ENGAJOU', false),
    ('dc7997da-96a3-4be9-97ac-16feec48becf'::uuid, 'SUMIU_APOS_COTACAO', false),
    ('6eb9f392-4560-4582-ae06-c58ec2824756'::uuid, 'NUNCA_ENGAJOU', false),
    ('0ada2e21-61f9-42a0-ad30-ff70985c4bf5'::uuid, 'SUMIU_APOS_COTACAO', false),
    ('d5d9555e-9ed6-4fc1-aae9-17b875c9942e'::uuid, 'SUMIU_APOS_COTACAO', false),
    ('0866b960-5e05-43ac-80f5-3d57b1715367'::uuid, 'SUMIU_APOS_COTACAO', false),
    ('0b40a23f-dd68-4e20-88b4-23a1c5095580'::uuid, 'SUMIU_APOS_COTACAO', false),
    ('122af725-91e1-4918-8d4e-c9bdae166ce8'::uuid, 'SUMIU_APOS_COTACAO', false),
    ('160af076-a0fe-4af8-8166-e31e06411625'::uuid, 'ATENDIMENTO_INTERROMPIDO', false),
    ('fd2d5e91-9b7c-4676-b7f8-bdcb7edcf234'::uuid, 'SUMIU_APOS_COTACAO', false),
    ('18f5f99f-1b3e-4a6f-a96e-71c272d1192f'::uuid, 'NUNCA_ENGAJOU', false),
    ('7488b104-1845-476f-a8ab-5775f3c42503'::uuid, 'SUMIU_APOS_COTACAO', false),
    ('52ad2d86-595c-4889-aaa7-aa1355f46005'::uuid, 'NUNCA_ENGAJOU', false),
    ('e0ac4a20-5c70-4fcb-920a-56a1d445d6b2'::uuid, 'NUNCA_ENGAJOU', false),
    ('217aac7c-94dd-4230-97f2-a376d4507b8d'::uuid, 'NUNCA_ENGAJOU', false),
    ('ebfa95f1-0eb3-4201-877f-466b4e684dbe'::uuid, 'NUNCA_ENGAJOU', false),
    ('8cff9745-ffc0-490f-85ca-42e2c3b26558'::uuid, 'SUMIU_APOS_COTACAO', false),
    ('240d890d-15eb-4fd4-b047-2d15c41f2cc0'::uuid, 'NUNCA_ENGAJOU', false),
    ('16aa202a-d55e-402e-a31f-7a01319846a2'::uuid, 'NUNCA_ENGAJOU', false),
    ('12404905-e641-4266-a76d-f67d361c3d87'::uuid, 'SUMIU_APOS_COTACAO', false),
    ('db4c935e-8525-4489-9052-3b3bc005c578'::uuid, 'NUNCA_ENGAJOU', false),
    ('1496f5d9-5c45-4797-8cd0-0a3fc35a0f1a'::uuid, 'NUNCA_ENGAJOU', false),
    ('1d9ec1fc-e8e3-4522-91f8-3f97609350cf'::uuid, 'NUNCA_ENGAJOU', false),
    ('4b52a964-23fe-4f32-ae3c-cb9601d24ac4'::uuid, 'NUNCA_ENGAJOU', false),
    ('918f4dfb-bc22-4da3-9cf5-beaeca81dc20'::uuid, 'NUNCA_ENGAJOU', false),
    ('35b085cd-fba3-4b4c-961d-2e97a847246e'::uuid, 'NUNCA_ENGAJOU', false),
    ('91cbcb87-9623-46bd-b59f-9b1f3ec1cbb8'::uuid, 'SUMIU_APOS_COTACAO', false),
    ('c5ba6a1d-9232-4bca-8134-5c474605178d'::uuid, 'SUMIU_APOS_COTACAO', false),
    ('b644126f-c8ee-4c1f-b2f0-b98d43e4c778'::uuid, 'NUNCA_ENGAJOU', false),
    ('a93f1172-5b11-4cb9-9765-eeda6b060995'::uuid, 'SUMIU_APOS_COTACAO', false),
    ('69dbe887-06b3-4779-b3b5-d42067bf1501'::uuid, 'SUMIU_APOS_COTACAO', false),
    ('c9ff22bf-1f3e-4ea4-8a23-bdbcced789b1'::uuid, 'NUNCA_ENGAJOU', false),
    ('4ce49c78-e630-478c-a0b7-7168fb0831fc'::uuid, 'NUNCA_ENGAJOU', false),
    ('d3cffff0-c9a1-4f22-a6f3-945b7d017f89'::uuid, 'SUMIU_APOS_COTACAO', false),
    ('5953c9ab-4b1d-405d-b3a9-561dfb66cdca'::uuid, 'SUMIU_APOS_COTACAO', false),
    ('da91b2a8-c493-4041-b5cc-7ae20aa355a0'::uuid, 'NUNCA_ENGAJOU', false),
    ('cd7c5a5b-b77a-47e7-8ab5-f23f9d2fd702'::uuid, 'NUNCA_ENGAJOU', false),
    ('bab48ea8-7068-4c0a-83a5-2c64a7cf64e8'::uuid, 'NUNCA_ENGAJOU', false),
    ('c47089f3-8be8-4293-be0d-609238177dbc'::uuid, 'NUNCA_ENGAJOU', false),
    ('ed398221-ca78-4e3b-9e85-894113e6da0f'::uuid, 'NUNCA_ENGAJOU', false),
    ('fcde5274-a007-4c2a-b3f4-4ffc7998c9e2'::uuid, 'NUNCA_ENGAJOU', false),
    ('8cb7d3b8-83b9-40df-a8be-198ccd3cb10b'::uuid, 'NUNCA_ENGAJOU', false),
    ('1fb85be3-a5a0-4e95-a648-08b3e59ed420'::uuid, 'SUMIU_APOS_COTACAO', false),
    ('ed924d8e-edf6-4633-8cb2-3c3bb1a69f3e'::uuid, 'NUNCA_ENGAJOU', false),
    ('094a705f-3eee-4720-847b-6b0884f0724b'::uuid, 'NUNCA_ENGAJOU', false),
    ('8b6de5ff-8f86-4695-ad8e-b5cf70639782'::uuid, 'NUNCA_ENGAJOU', false),
    ('e557847b-a92f-4011-91de-745ec3c9b229'::uuid, 'NUNCA_ENGAJOU', false),
    ('eca2ed3b-2941-4030-85df-33ae666d3bcd'::uuid, 'NUNCA_ENGAJOU', false),
    ('51e5e83b-767c-4b06-851a-6fdd146e6e6a'::uuid, 'NUNCA_ENGAJOU', false),
    ('007e892a-4556-4313-a24e-9ddc2563ee14'::uuid, 'NUNCA_ENGAJOU', false),
    ('bf5b85e2-9ab9-442a-a229-25f46bd6adb9'::uuid, 'ATENDIMENTO_INTERROMPIDO', false),
    ('2e09a1f9-2b6a-4fb7-95bf-aadfccc0459c'::uuid, 'NUNCA_ENGAJOU', false),
    ('bea721f0-d9a8-4fc1-88b9-8bdf1f31ed3d'::uuid, 'SUMIU_APOS_COTACAO', false),
    ('3bce21e7-26e2-4882-98fb-67bde4fbb5bd'::uuid, 'SUMIU_APOS_COTACAO', false),
    ('ee960f19-133e-4b5b-9317-516fe4c9ba02'::uuid, 'NUNCA_ENGAJOU', false),
    ('ea244ab7-83da-4f3b-9387-0a219d5ab3f7'::uuid, 'SUMIU_APOS_COTACAO', false),
    ('d66983c4-c5ac-4b1b-80b0-0a60790f8133'::uuid, 'NUNCA_ENGAJOU', false),
    ('0bf30edd-97de-4339-8fa0-886474bced59'::uuid, 'NUNCA_ENGAJOU', false),
    ('b5e3cd42-088e-4391-a35c-af321d966058'::uuid, 'NUNCA_ENGAJOU', false),
    ('e3780003-d202-4f4f-864c-26380649cae1'::uuid, 'NUNCA_ENGAJOU', false),
    ('f718c716-6d65-4eae-b0e4-df7c2943548e'::uuid, 'SUMIU_APOS_COTACAO', false),
    ('10cd2bd2-9127-4977-a098-38febeccfbc6'::uuid, 'NUNCA_ENGAJOU', false),
    ('d89e915b-a501-4f98-95a7-0655ded226e1'::uuid, 'NUNCA_ENGAJOU', false),
    ('0a057846-1c78-43e0-921a-36f8355abaf1'::uuid, 'NUNCA_ENGAJOU', false),
    ('7565972e-57a5-4bc6-89cd-46da1f2abc74'::uuid, 'SUMIU_APOS_COTACAO', false),
    ('0829bf40-1c35-497d-bf4c-5e46c5c02c04'::uuid, 'NUNCA_ENGAJOU', false),
    ('13f108b5-6caf-4c5e-9d06-fd100ffd2ce7'::uuid, 'SUMIU_APOS_COTACAO', false),
    ('fd678384-8404-4f3d-80d4-648dabb0a969'::uuid, 'NUNCA_ENGAJOU', false),
    ('e53cd9da-d830-4398-bef7-40c411ecc522'::uuid, 'SUMIU_APOS_COTACAO', false),
    ('58197619-0e03-4ab6-9574-419468af032f'::uuid, 'NUNCA_ENGAJOU', false),
    ('afa15797-2e19-4847-a5d7-05c0a8a0137b'::uuid, 'NUNCA_ENGAJOU', false),
    ('acc0726f-d873-43eb-827d-8f6e96a1c19b'::uuid, 'NUNCA_ENGAJOU', false),
    ('fb1a811e-fbd5-45cc-b7af-97c4296b867e'::uuid, 'SUMIU_APOS_COTACAO', false),
    ('a40029c9-bbfd-4eea-b000-db4acb69ab64'::uuid, 'SUMIU_APOS_COTACAO', false),
    ('7d48d79f-8dc7-49ea-be81-e002180ab4a9'::uuid, 'NUNCA_ENGAJOU', false),
    ('539e1b24-c3e1-455e-af5b-9ab638ea30a2'::uuid, 'NUNCA_ENGAJOU', false),
    ('05499b82-1ac9-4853-80be-46038ec65703'::uuid, 'NUNCA_ENGAJOU', false),
    ('76b4a60e-4d7a-4651-8254-16bf2af13a26'::uuid, 'NUNCA_ENGAJOU', false),
    ('8c30e0fb-2253-4bc2-939d-af9024e5b545'::uuid, 'NUNCA_ENGAJOU', false),
    ('8260e7bb-f4cd-4d80-bd5f-1c314a532888'::uuid, 'ATENDIMENTO_INTERROMPIDO', false),
    ('d62d65b7-ea0e-46f5-b08c-3c401629e1c9'::uuid, 'ATENDIMENTO_INTERROMPIDO', false),
    ('9814c525-bfce-431c-bff3-ea0b04823f42'::uuid, 'NUNCA_ENGAJOU', false),
    ('cd17b8e3-0fee-41e3-b221-ab46fd1ecec1'::uuid, 'SUMIU_APOS_COTACAO', false),
    ('cce02046-e45c-4719-ad61-1bef17afeabd'::uuid, 'NUNCA_ENGAJOU', false),
    ('ca9424a8-2139-4de0-9773-e74e00e2cc2f'::uuid, 'NUNCA_ENGAJOU', false),
    ('fa4fad86-fbff-4379-a4b6-3e92c9c5dd51'::uuid, 'NUNCA_ENGAJOU', false),
    ('2ef0fc87-76a7-4780-aee3-3d6b12507099'::uuid, 'NUNCA_ENGAJOU', false),
    ('67f9f7fa-aa51-4833-b034-f6907209435c'::uuid, 'NUNCA_ENGAJOU', false),
    ('b175f128-c01d-4278-ace0-f9d78bcfd978'::uuid, 'NUNCA_ENGAJOU', false),
    ('04513a28-e85f-44c8-a284-3af6d42294a7'::uuid, 'SUMIU_APOS_COTACAO', false),
    ('55d97b42-655f-4e65-8c14-de8cc7167820'::uuid, 'SUMIU_APOS_COTACAO', false),
    ('9ad750e3-f185-4f94-8cab-ecee05b05564'::uuid, 'NUNCA_ENGAJOU', false),
    ('5a252e89-d8e8-4e19-8add-917402142630'::uuid, 'NUNCA_ENGAJOU', false),
    ('e296897d-7b00-4802-a24b-c3785fe15d78'::uuid, 'ATENDIMENTO_INTERROMPIDO', false),
    ('b952ceb7-955f-499c-bc37-17135c0b63b3'::uuid, 'NUNCA_ENGAJOU', false),
    ('976af5b6-2b45-497f-b2ac-581118fd13e5'::uuid, 'NUNCA_ENGAJOU', false),
    ('c4b61de7-c527-4e9a-9a2b-abb2e6ea2600'::uuid, 'NUNCA_ENGAJOU', false),
    ('b49d7cf7-8518-490f-863f-7889f94f611f'::uuid, 'NUNCA_ENGAJOU', false),
    ('0dbba72a-c1cb-4487-a9c7-be5907f7d000'::uuid, 'NUNCA_ENGAJOU', false),
    ('a55e50f4-5390-443d-a819-b271e891df90'::uuid, 'NUNCA_ENGAJOU', false),
    ('bd4d4cce-e468-4bf9-a32f-6865b9853cf0'::uuid, 'NUNCA_ENGAJOU', false),
    ('f641b2ba-df8f-4926-988a-7606be0df2a0'::uuid, 'NUNCA_ENGAJOU', false),
    ('a89f2500-20ed-4953-9af4-65a4bd741424'::uuid, 'NUNCA_ENGAJOU', false),
    ('6252fb60-f952-4d3a-8b68-6b785d1a7a6c'::uuid, 'SUMIU_APOS_COTACAO', false),
    ('9af5e587-cb5b-49bc-bc0d-a8486bf17086'::uuid, 'SUMIU_APOS_COTACAO', false),
    ('e8e3f7d8-6a54-4b3e-8dc6-23f457011473'::uuid, 'SUMIU_APOS_COTACAO', false),
    ('6656ff39-dbc6-4c33-84f6-ada270b19259'::uuid, 'NUNCA_ENGAJOU', false),
    ('565750d1-86f9-45af-b496-4793437a701a'::uuid, 'SUMIU_APOS_COTACAO', false),
    ('985bd7bd-b691-47ce-97f7-bec4cb5315d4'::uuid, 'NUNCA_ENGAJOU', false),
    ('8b4b1be6-9aad-45a3-a4ab-fa2b52a909e1'::uuid, 'NUNCA_ENGAJOU', false),
    ('e143a783-c8f1-4a2d-a2f0-0e552a5d2120'::uuid, 'ATENDIMENTO_INTERROMPIDO', false),
    ('151cb158-bee3-492b-bc1c-ab3df8260324'::uuid, 'NUNCA_ENGAJOU', false),
    ('b69b0a67-0d84-4645-839c-54ad887ba54b'::uuid, 'SUMIU_APOS_COTACAO', false),
    ('7cff6d86-15d1-4b31-bd64-f0256737a943'::uuid, 'NUNCA_ENGAJOU', false),
    ('d35aef5f-0d48-4e6b-aacf-90967d4c30f9'::uuid, 'SUMIU_APOS_COTACAO', false),
    ('d76fcfac-3093-40fd-a576-6b4c9327b707'::uuid, 'NUNCA_ENGAJOU', false),
    ('c4582b03-ae9c-4887-8638-71dc12824e8f'::uuid, 'ATENDIMENTO_INTERROMPIDO', false),
    ('8dfdb407-c688-4f67-80b8-df61078cf48e'::uuid, 'SUMIU_APOS_COTACAO', false),
    ('28a7ca56-04ef-431f-b63e-3ce92209f09d'::uuid, 'NUNCA_ENGAJOU', false),
    ('6557a57e-8c4d-403d-bde2-df41a8c2b650'::uuid, 'NUNCA_ENGAJOU', false),
    ('005b802d-4f38-4c66-b6d4-ce86ebd582e2'::uuid, 'NUNCA_ENGAJOU', false),
    ('1c13e45c-f149-417d-9ee5-90b6d670db26'::uuid, 'NUNCA_ENGAJOU', false),
    ('37ffdc7d-3404-4ed2-a990-886881d7cd43'::uuid, 'NUNCA_ENGAJOU', false),
    ('d9419598-f6f8-46e4-9d09-833f19605345'::uuid, 'NUNCA_ENGAJOU', false),
    ('a3ae41a0-a5d5-4f0e-9066-78b2840c39c6'::uuid, 'SUMIU_APOS_COTACAO', false),
    ('ebf0da56-dd0e-4755-8881-7928ed36a0ea'::uuid, 'SUMIU_APOS_COTACAO', false),
    ('557b6e93-c57f-4ac4-a9e2-6c4e6f3a0d03'::uuid, 'SUMIU_APOS_COTACAO', false),
    ('cfae9457-6bca-4dae-b5ea-6639153bc751'::uuid, 'SUMIU_APOS_COTACAO', false),
    ('6121e62d-4974-4527-ae8c-00a0e7f64e75'::uuid, 'NUNCA_ENGAJOU', false),
    ('7e8ef275-9185-4ab7-aba8-ee32645b60fa'::uuid, 'NUNCA_ENGAJOU', false),
    ('350c3a96-29b4-48db-a433-e810600800d4'::uuid, 'ATENDIMENTO_INTERROMPIDO', false),
    ('167b6502-610e-4e8d-9e89-6f768e909f1d'::uuid, 'SUMIU_APOS_COTACAO', false),
    ('29314f31-d169-4f01-9841-baf3f0d83438'::uuid, 'SUMIU_APOS_COTACAO', false),
    ('e4b8ec95-bed4-4b26-a2df-37970e46fc4f'::uuid, 'NUNCA_ENGAJOU', false),
    ('2352fa4c-1f86-4031-b09f-ae485940d1d2'::uuid, 'SUMIU_APOS_COTACAO', false),
    ('11425ec0-3d56-4ca3-83fa-c614f70ef7c1'::uuid, 'SUMIU_APOS_COTACAO', false),
    ('6ecddbf3-feb4-4b70-a967-477420cb7ae4'::uuid, 'NUNCA_ENGAJOU', false),
    ('ff957c1a-8dad-4801-a482-2deeb75ffcc8'::uuid, 'NUNCA_ENGAJOU', false),
    ('c8fa49c8-f6fb-4b39-8bda-6167254a1389'::uuid, 'NUNCA_ENGAJOU', false),
    ('d2b4121c-3a54-4b4b-8801-50cdb846e8c4'::uuid, 'NUNCA_ENGAJOU', false),
    ('4bbe063c-4ad5-466a-b65b-cd9106470f70'::uuid, 'NUNCA_ENGAJOU', false),
    ('dac6e37d-29fc-49b4-9296-b92d97245ca5'::uuid, 'NUNCA_ENGAJOU', false),
    ('18a98135-6a39-434e-9a08-be78021b9e8a'::uuid, 'NUNCA_ENGAJOU', false),
    ('d7ae5308-f4eb-4fc5-a3d8-1b6c10723fa9'::uuid, 'NUNCA_ENGAJOU', false),
    ('c3c4bdab-1640-4716-8047-afd6dc7365cb'::uuid, 'SUMIU_APOS_COTACAO', false),
    ('f900fc47-0900-4cb2-ada4-ba4c52facbec'::uuid, 'SUMIU_APOS_COTACAO', false),
    ('e4adbfd5-4aea-4294-8c2a-b3b6f16f895a'::uuid, 'NUNCA_ENGAJOU', false),
    ('06a368bc-cdfd-4852-8528-fbad430f3bc9'::uuid, 'SUMIU_APOS_COTACAO', false),
    ('897b6117-18a8-43eb-8e29-6517f7d3a4a7'::uuid, 'SUMIU_APOS_COTACAO', false),
    ('de4467da-204c-4474-a895-1baa54fe08dd'::uuid, 'SUMIU_APOS_COTACAO', false),
    ('b3e9494e-eda3-4493-a419-30233c619c82'::uuid, 'SUMIU_APOS_COTACAO', false),
    ('e456a798-2826-49d3-a778-06b0934e4701'::uuid, 'SUMIU_APOS_COTACAO', false),
    ('f2bf03f7-5976-49e0-a471-4e9c82b49292'::uuid, 'SUMIU_APOS_COTACAO', false),
    ('8138d091-bf9b-436c-9e4a-814ef7360e38'::uuid, 'SUMIU_APOS_COTACAO', false),
    ('2fca0305-818d-4bf1-90d7-06776b11b6ec'::uuid, 'SUMIU_APOS_COTACAO', false),
    ('3af609bd-c580-4702-84d0-fc5c4e6beb57'::uuid, 'NUNCA_ENGAJOU', false),
    ('218d117a-44c5-432e-b1a9-0905bba0cf47'::uuid, 'NUNCA_ENGAJOU', false),
    ('104c0c76-301f-49a7-bc7f-6ef5c056301e'::uuid, 'SUMIU_APOS_COTACAO', false),
    ('bd8aa766-e7ac-43b8-8619-1ac21d80bd47'::uuid, 'SUMIU_APOS_COTACAO', false),
    ('76f6704b-76e5-4378-88a0-6c5080b7c055'::uuid, 'NUNCA_ENGAJOU', false),
    ('20af1e36-6b83-4f61-9e3b-65ef54d63a08'::uuid, 'ATENDIMENTO_INTERROMPIDO', false),
    ('e5bfbe91-b145-4e45-84fa-ddef774d83e5'::uuid, 'NUNCA_ENGAJOU', false),
    ('6dfa915a-714f-4e1d-b8a4-f0c7625e91cd'::uuid, 'NUNCA_ENGAJOU', false),
    ('68709331-d7b0-41dd-a8ca-a671813b1fc4'::uuid, 'NUNCA_ENGAJOU', false),
    ('cf33ab42-0576-4ede-8344-6ead07394f3b'::uuid, 'SUMIU_APOS_COTACAO', false),
    ('a87f6477-7a3b-433c-9652-062a656d88fd'::uuid, 'SUMIU_APOS_COTACAO', false),
    ('e7f8b780-8536-4297-9a35-7dfd28dd54fd'::uuid, 'SUMIU_APOS_COTACAO', false),
    ('267e8609-7cfb-408f-bead-1951b502cc37'::uuid, 'NUNCA_ENGAJOU', false),
    ('26da22d4-4ab9-42e1-bdcd-6fd7624645a5'::uuid, 'NUNCA_ENGAJOU', false),
    ('409992d9-d30e-419a-b2ab-dff8e4488c2e'::uuid, 'ATENDIMENTO_INTERROMPIDO', false),
    ('9b577570-93c0-478c-9d5a-36fc5805a0db'::uuid, 'NUNCA_ENGAJOU', false),
    ('9e5d8702-f593-44af-8927-cab501d2d06f'::uuid, 'NUNCA_ENGAJOU', false),
    ('0eedc406-656f-4e72-8828-f1de6bfd9917'::uuid, 'NUNCA_ENGAJOU', false),
    ('938f03a1-7931-47da-be7a-b48c8b370ebc'::uuid, 'NUNCA_ENGAJOU', false),
    ('08c01d60-0505-487c-806a-fdfb78be4484'::uuid, 'NUNCA_ENGAJOU', false),
    ('3a4cce8f-2163-4969-8a36-343c7b914e75'::uuid, 'SUMIU_APOS_COTACAO', false),
    ('2528733e-58c2-4f82-886f-c3f2af392490'::uuid, 'SUMIU_APOS_COTACAO', false),
    ('56043ccc-bdfb-4683-b029-094b5c0ce195'::uuid, 'ATENDIMENTO_INTERROMPIDO', false),
    ('d1c21f28-7a1b-4b63-a713-6acb473d2294'::uuid, 'NUNCA_ENGAJOU', false),
    ('207e9b6b-85fd-480e-b72d-f35942f8689d'::uuid, 'NUNCA_ENGAJOU', false),
    ('d8c454c2-b3c4-4e19-b2a0-e86b3b10da1b'::uuid, 'NUNCA_ENGAJOU', false),
    ('28f91dca-22eb-42b1-9deb-702c03898e0e'::uuid, 'ATENDIMENTO_INTERROMPIDO', false),
    ('0af605b1-310d-4911-8154-419312853c2d'::uuid, 'NUNCA_ENGAJOU', false),
    ('df457d57-2ab4-4574-bab2-b75e2bf00546'::uuid, 'NUNCA_ENGAJOU', false),
    ('8d742397-95e6-4f78-a5c4-20b439be166d'::uuid, 'NUNCA_ENGAJOU', false),
    ('e36a1fe0-1720-4169-8716-2533f21713e4'::uuid, 'ATENDIMENTO_INTERROMPIDO', false),
    ('783a8ba2-b3ad-4b58-97a5-505d841706b1'::uuid, 'NUNCA_ENGAJOU', false),
    ('591d0311-db50-4102-bf37-8b3d1fd9e503'::uuid, 'NUNCA_ENGAJOU', false),
    ('5f3ce989-3bb7-443b-a88d-98447cef835f'::uuid, 'NUNCA_ENGAJOU', false),
    ('48448bc6-0633-4043-9a06-2d1c5de9e58f'::uuid, 'NUNCA_ENGAJOU', false),
    ('cabb725d-73f0-45a0-8f6b-7753dd407adf'::uuid, 'NUNCA_ENGAJOU', false),
    ('d79ab9ca-596d-495e-aa29-8b2b573d1c6c'::uuid, 'NUNCA_ENGAJOU', false),
    ('941bdc6c-3034-42cc-be9b-c78925ec6f5e'::uuid, 'NUNCA_ENGAJOU', false),
    ('4c3e9974-4819-49d5-8140-73ae85ddb4d7'::uuid, 'NUNCA_ENGAJOU', false),
    ('b44b0264-c834-4ef9-9d14-45dd4930854a'::uuid, 'NUNCA_ENGAJOU', false),
    ('15ed733a-dd07-4cff-a0d8-78dcdbdfe970'::uuid, 'NUNCA_ENGAJOU', false),
    ('68ec6bd7-4b35-4e57-8d41-4a2e35b105dd'::uuid, 'ATENDIMENTO_INTERROMPIDO', false),
    ('c97bb665-715c-4313-9a80-d902dd90966e'::uuid, 'NUNCA_ENGAJOU', false),
    ('4a56c004-4610-46bb-8c80-dde63697d453'::uuid, 'NUNCA_ENGAJOU', false),
    ('33e7ec87-4ede-4feb-b3d4-e7b032678b13'::uuid, 'NUNCA_ENGAJOU', false),
    ('a999cc9e-a6d6-4655-bdd5-405bcea9075b'::uuid, 'NUNCA_ENGAJOU', false),
    ('d3502b99-f184-4d97-9675-6eef3f162106'::uuid, 'NUNCA_ENGAJOU', false),
    ('f5adc87d-0039-40c6-9d9c-fb023c2e65d6'::uuid, 'SUMIU_APOS_COTACAO', false),
    ('3e726dfc-b4e0-44bc-84f2-34295fca3c20'::uuid, 'SUMIU_APOS_COTACAO', false),
    ('9fc78075-7dfe-4042-a612-0ab0d9c39c32'::uuid, 'NUNCA_ENGAJOU', false),
    ('ecba5514-1a22-4d8e-ab7c-d6dd98589641'::uuid, 'SUMIU_APOS_COTACAO', false),
    ('520ad2d9-4fb5-4183-b1f8-d667b5c217b2'::uuid, 'NUNCA_ENGAJOU', false),
    ('bc140804-c143-4f2f-b26a-7ede13ceb776'::uuid, 'NUNCA_ENGAJOU', false),
    ('a5f5c8fa-9d61-4fec-91a0-8cb832dfaf01'::uuid, 'NUNCA_ENGAJOU', false),
    ('dae51718-f547-4a83-812b-d536b78b6673'::uuid, 'NUNCA_ENGAJOU', false),
    ('c2870e7b-4401-401d-94c5-6caf182065c5'::uuid, 'NUNCA_ENGAJOU', false),
    ('07175d86-00c2-40d3-be46-ecca59d8fbb7'::uuid, 'NUNCA_ENGAJOU', false),
    ('96196766-dbc9-4936-a8ff-063af19345e4'::uuid, 'SUMIU_APOS_COTACAO', false),
    ('7d2d5387-e7e3-4b45-b5b2-0c58643f92fa'::uuid, 'SUMIU_APOS_COTACAO', false),
    ('16c274a0-810b-4096-b6a8-194ea6645d5b'::uuid, 'ATENDIMENTO_INTERROMPIDO', false),
    ('8473d9bf-64cf-4eb4-b026-8abbde920600'::uuid, 'NUNCA_ENGAJOU', false),
    ('a8e12a76-940f-4651-9a89-688bf1b8e48b'::uuid, 'NUNCA_ENGAJOU', false),
    ('b4d35020-2b44-4033-8716-12824bf53e87'::uuid, 'ATENDIMENTO_INTERROMPIDO', false),
    ('2fe5f56b-7e73-47cb-8210-be27997e4392'::uuid, 'NUNCA_ENGAJOU', false),
    ('348ad982-72fc-4cf2-aa71-ab69af4d51c5'::uuid, 'NUNCA_ENGAJOU', false),
    ('0111d0f6-b36b-4a49-ab67-98ea6f167ca5'::uuid, 'ATENDIMENTO_INTERROMPIDO', false),
    ('b5189e2b-69b1-42dc-9de3-d4b959999587'::uuid, 'NUNCA_ENGAJOU', false),
    ('14203376-2a81-4013-aa28-da7afb08f6ee'::uuid, 'ATENDIMENTO_INTERROMPIDO', false),
    ('33d9513c-b92a-4ab0-83ea-eaedbcaa05b5'::uuid, 'NUNCA_ENGAJOU', false),
    ('060f752f-be3b-433e-9c06-1a5fdc56d580'::uuid, 'NUNCA_ENGAJOU', false),
    ('d68afff9-6758-423a-9bbe-09aa03e07b78'::uuid, 'NUNCA_ENGAJOU', false),
    ('a5f3e689-b588-47d5-827f-e22bc1674b5d'::uuid, 'NUNCA_ENGAJOU', false),
    ('6e42a98d-7afd-4b29-a482-2271a04d03ef'::uuid, 'NUNCA_ENGAJOU', false),
    ('a5e2eb3e-244a-44bb-bbd6-b15c106ad0fc'::uuid, 'NUNCA_ENGAJOU', false),
    ('7930b460-50c1-4828-953e-db3056d6d709'::uuid, 'ATENDIMENTO_INTERROMPIDO', false),
    ('1b3feb2c-243e-434d-a0e5-cd0bf96bddf0'::uuid, 'NUNCA_ENGAJOU', false),
    ('e3b47312-adf8-421f-a133-d46d4e5ac072'::uuid, 'ATENDIMENTO_INTERROMPIDO', false),
    ('e54271a4-12a0-49dc-a947-c36c3c205d4a'::uuid, 'NUNCA_ENGAJOU', false),
    ('8a52cc82-cb63-48a3-b7e0-b5663a1facbe'::uuid, 'NUNCA_ENGAJOU', false),
    ('08a6ecee-63d8-4c2b-b802-7b6b9d0ca23a'::uuid, 'NUNCA_ENGAJOU', false),
    ('6f33094a-b8d6-426a-ae90-32b593bf67bb'::uuid, 'NUNCA_ENGAJOU', false),
    ('065a50bc-e0cb-4875-96a1-8ac295117e2c'::uuid, 'NUNCA_ENGAJOU', false),
    ('a6475e92-f683-4645-aea8-67327ab20a15'::uuid, 'NUNCA_ENGAJOU', false),
    ('94eace58-a829-4286-aaa5-c6953dde2202'::uuid, 'NUNCA_ENGAJOU', false),
    ('ce5c4815-9b14-488e-af46-e369b88f1c59'::uuid, 'NUNCA_ENGAJOU', false),
    ('fa067619-071a-4149-8728-547af5f548a3'::uuid, 'NUNCA_ENGAJOU', false),
    ('82793441-9385-4645-9616-009e50748611'::uuid, 'NUNCA_ENGAJOU', false),
    ('c16faf30-9cd8-4be6-a3f0-c26539ea7084'::uuid, 'NUNCA_ENGAJOU', false),
    ('06235397-42b6-4d3a-80ca-9d9499b0944b'::uuid, 'NUNCA_ENGAJOU', false),
    ('5386e599-9d03-4b52-a32c-081149c9e90e'::uuid, 'NUNCA_ENGAJOU', false),
    ('89302628-fcd7-4813-a23b-8ded603ad5df'::uuid, 'NUNCA_ENGAJOU', false),
    ('4559c919-1f07-497a-b229-74fd969ec98d'::uuid, 'NUNCA_ENGAJOU', false),
    ('3937ba93-5513-49d3-80c8-c8e50221ae83'::uuid, 'NUNCA_ENGAJOU', false),
    ('a64990e3-7ce5-4db0-901a-01f71a15d77d'::uuid, 'NUNCA_ENGAJOU', false),
    ('d4a5e660-9eae-46d3-bf35-441c101a271f'::uuid, 'ATENDIMENTO_INTERROMPIDO', false),
    ('c6825e6f-4499-40d2-8fdc-e370318eb1b5'::uuid, 'NUNCA_ENGAJOU', false),
    ('e485dc40-6d28-4baf-a280-a57ba70fc02b'::uuid, 'ATENDIMENTO_INTERROMPIDO', false),
    ('9fad1b8a-ed39-4a67-ad94-ee7730c1f394'::uuid, 'NUNCA_ENGAJOU', false),
    ('035bc8cf-eea0-4df9-a13d-b4783b2abc37'::uuid, 'NUNCA_ENGAJOU', false),
    ('795d6185-e50a-4392-87ce-b9337f2dc154'::uuid, 'NUNCA_ENGAJOU', false),
    ('998d9654-9beb-45ba-81a7-8b449e11c8b3'::uuid, 'NUNCA_ENGAJOU', false),
    ('4062cfb2-ade0-489e-85c4-56141617225c'::uuid, 'NUNCA_ENGAJOU', false),
    ('f825148c-7534-42cb-8c80-097015248d68'::uuid, 'NUNCA_ENGAJOU', false),
    ('f2917344-db50-40c9-b902-4e1639980051'::uuid, 'NUNCA_ENGAJOU', false),
    ('0d351153-f9f1-41c4-ac73-4c12efc67b38'::uuid, 'NUNCA_ENGAJOU', false),
    ('4aaddd7f-edb8-4240-864c-e94362b9cf8b'::uuid, 'NUNCA_ENGAJOU', false),
    ('fb3ce7b8-f881-4174-82a6-70863303e456'::uuid, 'NUNCA_ENGAJOU', false),
    ('d0ebfadf-6bc5-4c07-be04-3e152871cadf'::uuid, 'NUNCA_ENGAJOU', false),
    ('dbafa433-a4c4-4c48-ac82-4be61184de3a'::uuid, 'NUNCA_ENGAJOU', false),
    ('59b0400c-9d23-4b82-86fb-7231ce86e837'::uuid, 'NUNCA_ENGAJOU', false),
    ('cfd7070b-93b4-4583-ab1f-3ca240fd4eae'::uuid, 'SUMIU_APOS_COTACAO', false),
    ('87d2cdfb-83c0-4b58-8292-4185be9602b4'::uuid, 'ATENDIMENTO_INTERROMPIDO', false),
    ('9fb7d55a-4f49-4e50-b1ee-7b08dd9272b0'::uuid, 'NUNCA_ENGAJOU', false),
    ('9f8f92f4-c68e-4bb9-83eb-c112b84906c3'::uuid, 'SUMIU_APOS_COTACAO', false),
    ('30f6501d-f5f7-4b13-93d7-3e6fe02a3dec'::uuid, 'NUNCA_ENGAJOU', false),
    ('05d769bd-2cb3-4298-a1cd-e6ce983b87a1'::uuid, 'NUNCA_ENGAJOU', false),
    ('9f3ade3f-3385-4633-89c8-13cf4e7b6963'::uuid, 'NUNCA_ENGAJOU', false),
    ('84cb8aba-730c-4a67-a701-0d95a9b56e9a'::uuid, 'NUNCA_ENGAJOU', false),
    ('30405598-6d7a-4123-a710-022d0fc6df8b'::uuid, 'NUNCA_ENGAJOU', false),
    ('5e1bbae0-ffec-4339-80b7-8a4219647289'::uuid, 'NUNCA_ENGAJOU', false),
    ('6a18216d-1403-4a75-ae29-a681d970a777'::uuid, 'NUNCA_ENGAJOU', false),
    ('0c9edb97-f4ad-4b2d-b9b7-c2f1bdd0ebf3'::uuid, 'NUNCA_ENGAJOU', false),
    ('753314fa-8d27-4ea2-8518-7ad359e2eb62'::uuid, 'NUNCA_ENGAJOU', false),
    ('a166633c-3a10-4ba3-acb6-8a2b0e51c653'::uuid, 'NUNCA_ENGAJOU', false),
    ('ea6cdbb7-1d11-4bf8-8e55-fe749f3ed1dc'::uuid, 'NUNCA_ENGAJOU', false),
    ('f90a3f14-a43b-4609-b243-f2381f49d8dc'::uuid, 'NUNCA_ENGAJOU', false),
    ('1e026526-6331-44ee-b324-5ddd8e98131c'::uuid, 'NUNCA_ENGAJOU', false),
    ('dd862177-3a07-4f72-bec0-d17a2f20e06b'::uuid, 'NUNCA_ENGAJOU', false),
    ('e0ab5c3c-4d88-469d-aaac-37334298e164'::uuid, 'NUNCA_ENGAJOU', false),
    ('fcd8d87c-0568-473d-8530-79e89a4cefc1'::uuid, 'NUNCA_ENGAJOU', false),
    ('6d2b8ca9-5ebe-4ea6-92aa-26426d6f1c6e'::uuid, 'SUMIU_APOS_COTACAO', false),
    ('875f85c8-87b8-42ec-9942-16cc4833e4c1'::uuid, 'NUNCA_ENGAJOU', false),
    ('b778d075-9ddb-4084-924e-c94a29876d42'::uuid, 'NUNCA_ENGAJOU', false),
    ('3d557e0a-3255-4cde-a5ca-db4bab5e03c7'::uuid, 'SUMIU_APOS_COTACAO', false),
    ('9d03e9e3-e97e-447d-8f43-aed5e1026851'::uuid, 'NUNCA_ENGAJOU', false),
    ('d005dab4-1d87-4f75-b1fd-7019e5b58b23'::uuid, 'NUNCA_ENGAJOU', false),
    ('7b5c6be6-f4d4-4f8e-bf38-bf169f3ddd3f'::uuid, 'NUNCA_ENGAJOU', false),
    ('f6c35c53-01bb-4695-aca0-e2f73a7f798d'::uuid, 'NUNCA_ENGAJOU', false),
    ('5f3a5933-ca57-4a5a-a315-dd9bdf32760d'::uuid, 'NUNCA_ENGAJOU', false),
    ('024b1bc1-2a03-42a1-92f9-a9f29955b9b6'::uuid, 'SUMIU_APOS_COTACAO', false),
    ('60d8f48a-b7fd-4a57-8573-507c79100c03'::uuid, 'NUNCA_ENGAJOU', false),
    ('71c3488f-b54d-436e-917c-02e6cc8c056b'::uuid, 'ATENDIMENTO_INTERROMPIDO', false),
    ('09380cae-b1d6-45db-90ab-30a2e7be9029'::uuid, 'NUNCA_ENGAJOU', false),
    ('548843e0-f1fe-47ee-9882-a659c3fcbc6b'::uuid, 'NUNCA_ENGAJOU', false),
    ('676394a7-e1b8-4b38-a151-77b0b2e2e829'::uuid, 'NUNCA_ENGAJOU', false),
    ('3256d2af-17fc-452b-ad19-f08901433fbc'::uuid, 'NUNCA_ENGAJOU', false),
    ('f723fd32-741c-4b50-a1d2-0b07baa898d1'::uuid, 'SUMIU_APOS_COTACAO', false),
    ('03b05b0d-31a3-4648-8f71-1c6a3579374e'::uuid, 'NUNCA_ENGAJOU', false),
    ('ddd9ddba-4dd3-4f0e-a7cd-566adc2e9ac8'::uuid, 'NUNCA_ENGAJOU', false),
    ('62a40971-757a-4a30-afa5-b1706f31d520'::uuid, 'NUNCA_ENGAJOU', false),
    ('f49352b1-b994-45cb-a290-4ec4ab106646'::uuid, 'NUNCA_ENGAJOU', false),
    ('70240eac-35cd-4653-ac12-66f361be668d'::uuid, 'ATENDIMENTO_INTERROMPIDO', false),
    ('8e258058-c39f-4679-b075-7c0ea6792aab'::uuid, 'NUNCA_ENGAJOU', false),
    ('85d2df6c-4a1d-4887-ad36-7ecff5880b59'::uuid, 'NUNCA_ENGAJOU', false),
    ('8d8c7a03-984f-4f94-85d8-0e305a75edd2'::uuid, 'NUNCA_ENGAJOU', false),
    ('96599f3f-09f5-48a6-9c55-48872d59460d'::uuid, 'NUNCA_ENGAJOU', false),
    ('7ab4edfc-7444-4b61-957f-3fb0fad63826'::uuid, 'ATENDIMENTO_INTERROMPIDO', false),
    ('19add2c3-a383-4ab2-89ed-331d2d63e2c6'::uuid, 'NUNCA_ENGAJOU', false),
    ('0544130e-3391-41c3-aee0-ca54f28e3c69'::uuid, 'NUNCA_ENGAJOU', false),
    ('a27eedd3-ca12-41ee-981a-0e55b98327c5'::uuid, 'NUNCA_ENGAJOU', false),
    ('286b9853-df1e-48d3-b7e2-924247883cef'::uuid, 'NUNCA_ENGAJOU', false),
    ('b5476a61-def4-41ff-9e1f-cf246ec16fed'::uuid, 'NUNCA_ENGAJOU', false),
    ('235e29ef-8c75-4b75-879f-574d8b5c248c'::uuid, 'SUMIU_APOS_COTACAO', false),
    ('27414dfc-b440-4f81-b30f-cb22def6cb26'::uuid, 'NUNCA_ENGAJOU', false),
    ('5ba113cb-51e5-4ea0-a1dd-9be07a34e425'::uuid, 'NUNCA_ENGAJOU', false),
    ('2047993a-a8f8-407d-8446-7b6adde9e588'::uuid, 'SUMIU_APOS_COTACAO', false),
    ('f73c8f46-7ba7-410c-a777-eb2319a62e3e'::uuid, 'NUNCA_ENGAJOU', false),
    ('7c80c043-f0d6-41dd-9138-c07e30600bf4'::uuid, 'NUNCA_ENGAJOU', false),
    ('12128a4a-30c7-4c41-8a89-485101168c60'::uuid, 'NUNCA_ENGAJOU', false),
    ('00c14e1e-6b89-4ab4-9053-9c039e171f34'::uuid, 'NUNCA_ENGAJOU', false),
    ('bc9f7ac9-fef1-4048-b676-9722d44681fc'::uuid, 'NUNCA_ENGAJOU', false),
    ('dcaa4f09-6ee9-4372-8129-5ff94ba0f380'::uuid, 'NUNCA_ENGAJOU', false),
    ('a99b59c9-ed8f-4ea7-a2ba-b502eba8759f'::uuid, 'NUNCA_ENGAJOU', false),
    ('8e59c739-cddc-4450-8e2d-2186cb9a041a'::uuid, 'SUMIU_APOS_COTACAO', false),
    ('d3724882-4c6f-4e75-ac22-5894f823070d'::uuid, 'NUNCA_ENGAJOU', false),
    ('c23bcc14-ee52-4f5e-9c3d-d4bdfc710480'::uuid, 'NUNCA_ENGAJOU', false),
    ('dd5de482-b405-4b3d-a5ab-169a3f870887'::uuid, 'NUNCA_ENGAJOU', false),
    ('c2fa67a7-a0c7-4301-8e8f-bab5dcfc1e3d'::uuid, 'SUMIU_APOS_COTACAO', false),
    ('70369f0b-c390-4acf-9d2f-bfff304f2511'::uuid, 'ATENDIMENTO_INTERROMPIDO', false),
    ('ddf962a9-ca37-4c84-8946-7686ed917053'::uuid, 'ATENDIMENTO_INTERROMPIDO', false),
    ('977278ec-82a0-42e1-8a62-e59fb98f582b'::uuid, 'SUMIU_APOS_COTACAO', false);

-- 2. Pre-APPLY validation
DO $$
DECLARE
  v_count integer;
  v_non_perdido integer;
  v_dest_exists boolean;
  v_reat_id uuid := 'c6131bfc-9d6a-430e-af7c-44f5d6731186';
  v_perdido_id uuid := 'e6dfc1b0-720d-446a-8ed1-d773f781bbba';
BEGIN
  -- Exactly 358 found
  SELECT count(*) INTO v_count FROM _apply_targets;
  IF v_count != 358 THEN
    RAISE EXCEPTION 'Expected 358 targets, found %', v_count;
  END IF;

  -- All currently Perdido
  SELECT count(*) INTO v_non_perdido
  FROM _apply_targets t
  JOIN leads l ON l.id = t.lead_id
  WHERE l.status_id != v_perdido_id;

  IF v_non_perdido > 0 THEN
    RAISE EXCEPTION '% leads are not in Perdido status', v_non_perdido;
  END IF;

  -- Destination exists
  SELECT EXISTS(SELECT 1 FROM lead_status_config WHERE id = v_reat_id) INTO v_dest_exists;
  IF NOT v_dest_exists THEN
    RAISE EXCEPTION 'Reativação status not found';
  END IF;

  -- None belong to excluded classifications
  IF EXISTS (
    SELECT 1 FROM audit_results r
    WHERE r.run_id = 'be2026df-c146-4a78-aa85-cf167580f500'
      AND r.lead_id IN (SELECT lead_id FROM _apply_targets)
      AND r.classification != 'MOVER_PARA_REATIVACAO'
  ) THEN
    RAISE EXCEPTION 'Some targets belong to excluded classifications';
  END IF;

  RAISE NOTICE 'Pre-APPLY validation passed: % targets, all Perdido, destination valid', v_count;
END $$;

-- 3. Phase 1: Set skip_automation = true for leads that don't have it
UPDATE leads
SET skip_automation = true
WHERE id IN (
  SELECT lead_id FROM _apply_targets WHERE original_skip = false
);

-- 4. Phase 2: Update status from Perdido to Reativação
UPDATE leads
SET status_id = 'c6131bfc-9d6a-430e-af7c-44f5d6731186'::uuid
WHERE id IN (SELECT lead_id FROM _apply_targets);

-- 5. Phase 3: Restore skip_automation to original values
UPDATE leads
SET skip_automation = t.original_skip
FROM _apply_targets t
WHERE leads.id = t.lead_id;

-- 6. Post-APPLY validation
DO $$
DECLARE
  v_updated integer;
  v_wrong_status integer;
  v_skip_wrong integer;
  v_reat_id uuid := 'c6131bfc-9d6a-430e-af7c-44f5d6731186';
  v_perdido_id uuid := 'e6dfc1b0-720d-446a-8ed1-d773f781bbba';
BEGIN
  -- Count updated to Reativação
  SELECT count(*) INTO v_updated
  FROM leads l
  JOIN _apply_targets t ON l.id = t.lead_id
  WHERE l.status_id = v_reat_id;

  IF v_updated != 358 THEN
    RAISE EXCEPTION 'Expected 358 updated to Reativação, found %', v_updated;
  END IF;

  -- None should still be Perdido
  SELECT count(*) INTO v_wrong_status
  FROM leads l
  JOIN _apply_targets t ON l.id = t.lead_id
  WHERE l.status_id = v_perdido_id;

  IF v_wrong_status > 0 THEN
    RAISE EXCEPTION '% leads still Perdido after update', v_wrong_status;
  END IF;

  -- Check skip_automation restored correctly
  SELECT count(*) INTO v_skip_wrong
  FROM leads l
  JOIN _apply_targets t ON l.id = t.lead_id
  WHERE COALESCE(l.skip_automation, false) != t.original_skip;

  IF v_skip_wrong > 0 THEN
    RAISE EXCEPTION '% leads have wrong skip_automation after restore', v_skip_wrong;
  END IF;

  RAISE NOTICE 'Post-APPLY validation passed: % updated to Reativação, skip_automation restored', v_updated;
END $$;

COMMIT;
