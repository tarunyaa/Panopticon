import { useWorldState } from '../../state/WorldState';
import { events } from '../../state/events';
import { PanZoomCanvas } from '../canvas/PanZoomCanvas';
import { Desk } from '../environment/Desk';
import { Character } from '../sprites/Character';
import { getPod, managerAgent } from '../../data/mockData';

// Pod view dimensions
const POD_WIDTH = 500;
const POD_HEIGHT = 400;

/**
 * PodScene - Inside pod with desks and agents
 */
export function PodScene() {
  const { state, dispatch } = useWorldState();
  const { podId, user } = state;

  const podData = podId ? getPod(podId) : null;

  if (!podData) {
    return (
      <div className="flex items-center justify-center h-full text-text-dark">
        Pod not found
      </div>
    );
  }

  const { org, pod } = podData;

  // Desk positions for agents
  const deskPositions = [
    { x: 120, y: 150 },  // Agent 1
    { x: 250, y: 150 },  // Agent 2
    { x: 380, y: 150 },  // Agent 3
    { x: 120, y: 280 },  // Agent 4
    { x: 380, y: 280 },  // Agent 5
  ];

  // Manager desk position (center)
  const managerDeskPos = { x: 250, y: 280 };

  // User desk position
  const userDeskPos = { x: 250, y: 350 };

  const handleAgentClick = (agentId: string) => {
    dispatch(events.openAgentCard(agentId));
  };

  return (
    <PanZoomCanvas width={POD_WIDTH} height={POD_HEIGHT}>
      {/* Background - pod interior */}
      <div
        className="absolute inset-0"
        style={{
          backgroundColor: '#F5F2EB',
          backgroundImage: `
            linear-gradient(rgba(0,0,0,0.015) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0,0,0,0.015) 1px, transparent 1px)
          `,
          backgroundSize: '20px 20px',
        }}
      />

      {/* Room walls */}
      <div
        className="absolute rounded-lg border-2"
        style={{
          left: 30,
          top: 30,
          right: 30,
          bottom: 30,
          borderColor: org.color + '30',
          backgroundColor: org.color + '08',
        }}
      />

      {/* Pod name */}
      <div
        className="absolute top-8 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full"
        style={{ backgroundColor: org.color + '20' }}
      >
        <span className="text-xs font-medium text-text-dark">{pod.name}</span>
      </div>

      {/* Agent desks and characters */}
      {pod.agents.slice(0, 5).map((agent, i) => {
        const deskPos = deskPositions[i];
        const isWorking = agent.status === 'working';

        return (
          <div key={agent.id}>
            {/* Desk */}
            <Desk
              position={deskPos}
              hasComputer={true}
              isActive={isWorking}
            />

            {/* Agent character */}
            <Character
              type="agent"
              name={agent.name}
              status={agent.status}
              position={{ x: deskPos.x, y: deskPos.y + 30 }}
              onClick={() => handleAgentClick(agent.id)}
              showBubble={true}
              scale={1.8}
            />
          </div>
        );
      })}

      {/* Manager desk */}
      <Desk
        position={managerDeskPos}
        hasComputer={true}
        isActive={true}
      />

      {/* Manager character */}
      <Character
        type="manager"
        name={managerAgent.name}
        status={managerAgent.status}
        position={{ x: managerDeskPos.x, y: managerDeskPos.y + 30 }}
        onClick={() => handleAgentClick(managerAgent.id)}
        showBubble={true}
        scale={2}
      />

      {/* User desk */}
      <Desk
        position={userDeskPos}
        hasComputer={true}
        isActive={false}
      />

      {/* User character */}
      {user && (
        <Character
          type="human"
          name={user.name}
          status="idle"
          position={{ x: userDeskPos.x, y: userDeskPos.y + 30 }}
          showBubble={false}
          scale={2}
        />
      )}
    </PanZoomCanvas>
  );
}
