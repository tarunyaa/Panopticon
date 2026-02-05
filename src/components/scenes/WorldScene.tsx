import { useWorldState } from '../../state/WorldState';
import { PanZoomCanvas } from '../canvas/PanZoomCanvas';
import { Building } from '../environment/Building';
import { Tree } from '../environment/Tree';
import { Character } from '../sprites/Character';
import { organizations } from '../../data/mockData';

// World dimensions
const WORLD_WIDTH = 800;
const WORLD_HEIGHT = 600;

// NPC positions for ambient life (keep minimal - 3-4 NPCs max)
const npcs = [
  { id: 'npc-1', name: 'NPC', position: { x: 150, y: 300 }, status: 'idle' as const },
  { id: 'npc-2', name: 'NPC', position: { x: 450, y: 250 }, status: 'working' as const },
  { id: 'npc-3', name: 'NPC', position: { x: 650, y: 400 }, status: 'idle' as const },
];

// Tree positions (decorative, kept minimal)
const trees = [
  { id: 't1', position: { x: 50, y: 100 }, size: 'small' as const },
  { id: 't2', position: { x: 100, y: 450 }, size: 'medium' as const },
  { id: 't3', position: { x: 720, y: 150 }, size: 'large' as const },
  { id: 't4', position: { x: 680, y: 500 }, size: 'medium' as const },
  { id: 't5', position: { x: 300, y: 520 }, size: 'small' as const },
  { id: 't6', position: { x: 550, y: 100 }, size: 'small' as const },
];

/**
 * WorldScene - Bird's-eye campus view
 * DOM-light: 1 background + few buildings + few NPCs + few trees
 */
export function WorldScene() {
  const { state, transitionTo } = useWorldState();
  const { user } = state;

  const handleBuildingClick = (orgId: string) => {
    const org = organizations.find(o => o.id === orgId);
    if (org) {
      transitionTo('org', orgId, { x: org.position.x, y: org.position.y });
    }
  };

  return (
    <PanZoomCanvas width={WORLD_WIDTH} height={WORLD_HEIGHT}>
      {/* Background layer - single div with grid pattern */}
      <div
        className="absolute inset-0"
        style={{
          backgroundColor: '#E8E4DC',
          backgroundImage: `
            linear-gradient(rgba(0,0,0,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0,0,0,0.03) 1px, transparent 1px)
          `,
          backgroundSize: '32px 32px',
        }}
      />

      {/* Paths - simple shapes */}
      <div
        className="absolute bg-wall/60 rounded"
        style={{ left: 180, top: 200, width: 340, height: 20 }}
      />
      <div
        className="absolute bg-wall/60 rounded"
        style={{ left: 350, top: 200, width: 20, height: 200 }}
      />
      <div
        className="absolute bg-wall/60 rounded"
        style={{ left: 180, top: 380, width: 200, height: 20 }}
      />

      {/* Grass patches - few large areas */}
      <div
        className="absolute rounded-full opacity-30"
        style={{
          left: 30,
          top: 80,
          width: 80,
          height: 60,
          backgroundColor: '#8FBC8F',
        }}
      />
      <div
        className="absolute rounded-full opacity-30"
        style={{
          left: 650,
          top: 120,
          width: 100,
          height: 70,
          backgroundColor: '#8FBC8F',
        }}
      />
      <div
        className="absolute rounded-full opacity-20"
        style={{
          left: 280,
          top: 480,
          width: 120,
          height: 80,
          backgroundColor: '#8FBC8F',
        }}
      />

      {/* Trees (decorative) */}
      {trees.map(tree => (
        <Tree key={tree.id} position={tree.position} size={tree.size} />
      ))}

      {/* Organization buildings */}
      {organizations.map(org => (
        <Building
          key={org.id}
          id={org.id}
          name={org.name}
          position={org.position}
          color={org.color}
          onClick={() => handleBuildingClick(org.id)}
          isUserOrg={user?.orgId === org.id}
        />
      ))}

      {/* User avatar */}
      {user && (
        <Character
          type="human"
          name={user.name}
          status="idle"
          position={{ x: 400, y: 450 }}
          showBubble={false}
          scale={2.5}
        />
      )}

      {/* Ambient NPCs (minimal) */}
      {npcs.map(npc => (
        <Character
          key={npc.id}
          type="agent"
          name=""
          status={npc.status}
          position={npc.position}
          showBubble={false}
          scale={1.5}
        />
      ))}
    </PanZoomCanvas>
  );
}
