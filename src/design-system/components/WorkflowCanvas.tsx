import ReactFlow, { type ReactFlowProps } from 'reactflow';
import { cx } from '../../lib/cx';

/** Vendor presentation boundary; graph state and callbacks stay with the owning feature. */
export default function WorkflowCanvas({ className, ...props }: ReactFlowProps) {
  return <ReactFlow {...props} className={cx('kds-workflow-canvas', className)} />;
}
export { Background as WorkflowBackground, Controls as WorkflowControls, Handle as WorkflowHandle, MiniMap as WorkflowMiniMap, Panel as WorkflowPanel } from 'reactflow';
