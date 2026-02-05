import { useWorldState } from '../../state/WorldState';
import { PanZoomCanvas } from '../canvas/PanZoomCanvas';
import { PodDoor } from '../environment/PodDoor';
import { Tree } from '../environment/Tree';
import { Character } from '../sprites/Character';
import { getOrganization } from '../../data/mockData';

// Org view dimensions
const ORG_WIDTH = 600;
const ORG_HEIGHT = 500;

/**
 * OrgScene - Inside organization view with pod doors
 */
export function OrgScene() {
  const { state, transitionTo } = useWorldState();
  const { orgId, user } = state;

  const org = orgId ? getOrganization(orgId) : null;

  if (!org) {
    return (
      <div className="flex items-center justify-center h-full text-text-dark">
        Organization not found
      </div>
    );
  }

  const handlePodClick = (podId: string) => {
    const pod = org.pods.find(p => p.id === podId);
    if (pod) {
      transitionTo('pod', podId, { x: pod.position.x, y: pod.position.y });
    }
  };

  return (
    <PanZoomCanvas width={ORG_WIDTH} height={ORG_HEIGHT}>
      {/* Background - interior floor */}
      <div
        className="absolute inset-0"
        style={{
          backgroundColor: '#F0EDE6',
          backgroundImage: `
            linear-gradient(rgba(0,0,0,0.02) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0,0,0,0.02) 1px, transparent 1px)
          `,
          backgroundSize: '24px 24px',
        }}
      />

      {/* Org building interior walls */}
      <div
        className="absolute rounded-lg border-4"
        style={{
          left: 40,
          top: 40,
          right: 40,
          bottom: 40,
          borderColor: org.color + '40',
          backgroundColor: org.color + '10',
        }}
      />

      {/* Central hallway */}
      <div
        className="absolute bg-wall/40 rounded"
        style={{ left: ORG_WIDTH / 2 - 15, top: 60, width: 30, height: ORG_HEIGHT - 120 }}
      />

      {/* Decorative plants */}
      <Tree position={{ x: 80, y: 100 }} size="small" />
      <Tree position={{ x: ORG_WIDTH - 80, y: 100 }} size="small" />
      <Tree position={{ x: 80, y: ORG_HEIGHT - 60 }} size="small" />
      <Tree position={{ x: ORG_WIDTH - 80, y: ORG_HEIGHT - 60 }} size="small" />

      {/* Pod doors */}
      {org.pods.map(pod => (
        <PodDoor
          key={pod.id}
          id={pod.id}
          name={pod.name}
          position={pod.position}
          onClick={() => handlePodClick(pod.id)}
          isUserPod={user?.podId === pod.id}
        />
      ))}

      {/* User avatar in org lobby */}
      {user && (
        <Character
          type="human"
          name={user.name}
          status="idle"
          position={{ x: ORG_WIDTH / 2, y: ORG_HEIGHT - 80 }}
          showBubble={false}
          scale={2}
        />
      )}

      {/* Org name banner */}
      <div
        className="absolute top-12 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full"
        style={{ backgroundColor: org.color + '30' }}
      >
        <span className="text-sm font-medium text-text-dark">{org.name}</span>
      </div>
    </PanZoomCanvas>
  );
}
