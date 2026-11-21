import { describe, expect, it, vi } from 'vitest';
import {
  MCP_CAMPAIGN_EXT_TOOLS, MCP_CAMPAIGN_EXT_READ_NAMES, MCP_CAMPAIGN_EXT_WRITE_NAMES,
  executeMcpCampaignExtendedRead, executeMcpCampaignExtendedWrite,
} from '../campaign-coverage-actions';
import {
  MCP_FLOW_TEMPLATE_TOOLS, MCP_FLOW_TEMPLATE_READ_NAMES, MCP_FLOW_TEMPLATE_WRITE_NAMES,
  executeMcpFlowTemplateWrite,
} from '../flow-template-actions';

const actorId='7b09577d-49ec-4f00-a54a-56bf370e5179';
const campaignId='42c47f2e-c306-493f-8d7d-c08495017974';

describe('MCP coverage — dispatch safety and descriptor parity',()=>{
  it('exposes unique tools with closed schemas and correct read/write annotations',()=>{
    const all=[...MCP_CAMPAIGN_EXT_TOOLS,...MCP_FLOW_TEMPLATE_TOOLS];
    const names=all.map(t=>t.name);
    expect(new Set(names).size).toBe(names.length);
    expect(names).toEqual(expect.arrayContaining([
      ...MCP_CAMPAIGN_EXT_READ_NAMES,...MCP_CAMPAIGN_EXT_WRITE_NAMES,
      ...MCP_FLOW_TEMPLATE_READ_NAMES,...MCP_FLOW_TEMPLATE_WRITE_NAMES,
    ]));
    for(const tool of all){
      expect(tool.inputSchema).toMatchObject({type:'object',additionalProperties:false});
      expect(tool.annotations?.readOnlyHint).toBe(tool.name.includes('_create_')||tool.name.includes('_update_')||tool.name.includes('_archive_')||tool.name.includes('_send_')||tool.name.includes('_reconcile_') ? false : true);
    }
  });

  it('will not invoke the worker without explicit send confirmation',async()=>{
    const rpc=vi.fn(),invoke=vi.fn();
    const result=await executeMcpCampaignExtendedWrite({
      supabase:{from:vi.fn(),rpc,functions:{invoke}} as never,
      toolName:'kifer_send_whatsapp_campaign_test',
      actorId,
      arguments:{campaign_id:campaignId,phone:'21999999999',variant:'A',step_index:0,confirm_send:false,client_request_id:'test:no-send'},
    });
    expect(result).toMatchObject({success:false,error_code:'INVALID_INPUT'});
    expect(invoke).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it('refuses unsafe chat merging without explicit confirmation',async()=>{
    const rpc=vi.fn();
    const result=await executeMcpCampaignExtendedWrite({
      supabase:{rpc} as never,toolName:'kifer_reconcile_verified_whatsapp_lid',
      actorId,
      arguments:{lid_chat_id:campaignId,phone_chat_id:'fdd9e7d8-8bc0-4a18-a0f5-f83a79f92c45',
        confirm_merge:false,client_request_id:'unsafe:merge'},
    });
    expect(result).toMatchObject({success:false,error_code:'INVALID_INPUT'});
    expect(rpc).not.toHaveBeenCalled();
  });

  it('does not query private campaign history when target id is invalid',async()=>{
    const from=vi.fn();
    const result=await executeMcpCampaignExtendedRead({
      supabase:{from} as never,toolName:'kifer_get_whatsapp_campaign_contact_history',
      actorId,arguments:{campaign_id:campaignId,target_id:'invalid'},
    });
    expect(result).toMatchObject({success:false,error_code:'INVALID_INPUT'});
    expect(from).not.toHaveBeenCalled();
  });

  it('rejects flow template writes without a valid optimistic version',async()=>{
    const from=vi.fn();
    const result=await executeMcpFlowTemplateWrite({
      supabase:{from} as never,actorId,toolName:'kifer_create_followup_message_template',
      args:{name:'Modelo',messages:['Olá'],client_request_id:'template:1',expected_updated_at:'invalid'},
    });
    expect(result).toMatchObject({success:false,error_code:'INVALID_INPUT'});
    expect(from).not.toHaveBeenCalled();
  });
});
