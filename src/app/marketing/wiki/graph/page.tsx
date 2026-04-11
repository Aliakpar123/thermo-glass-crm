'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import Layout from '@/components/Layout';
import { PAIN_CATEGORIES, LOSS_REASON_LABELS } from '@/types';

interface GraphNode {
  id: string;
  label: string;
  type: 'pain' | 'city' | 'room' | 'objection';
  count: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

interface GraphEdge {
  from: string;
  to: string;
}

interface WikiData {
  pain_stats: { category: string; count: number }[];
  pains_by_city: { city: string; category: string; count: number }[];
  pains_by_room: { room_type: string; category: string; count: number }[];
  segments: unknown[];
  objections: { reason: string; count: number }[];
}

function expandPainStats(stats: { category: string; count: number }[]) {
  const map: Record<string, number> = {};
  for (const s of stats) {
    const cats = s.category.split(',').filter(Boolean);
    for (const c of cats) {
      map[c] = (map[c] || 0) + Number(s.count);
    }
  }
  return Object.entries(map).map(([category, count]) => ({ category, count })).sort((a, b) => b.count - a.count);
}

function expandPainsByGroup(items: { category: string; count: number; [key: string]: unknown }[], groupKey: string) {
  const result: { group: string; category: string; count: number }[] = [];
  for (const item of items) {
    const group = String(item[groupKey] || '');
    if (!group) continue;
    const cats = item.category.split(',').filter(Boolean);
    for (const c of cats) {
      result.push({ group, category: c, count: Number(item.count) });
    }
  }
  return result;
}

const NODE_COLORS: Record<string, string> = {
  pain: '#3b82f6',
  city: '#10b981',
  room: '#f59e0b',
  objection: '#ef4444',
};

export default function WikiGraphPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [data, setData] = useState<WikiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const nodesRef = useRef<GraphNode[]>([]);
  const edgesRef = useRef<GraphEdge[]>([]);
  const animFrameRef = useRef<number>(0);
  const dragRef = useRef<{ dragging: boolean; nodeIdx: number; offsetX: number; offsetY: number }>({ dragging: false, nodeIdx: -1, offsetX: 0, offsetY: 0 });

  useEffect(() => {
    fetch('/api/wiki')
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const buildGraph = useCallback((width: number, height: number) => {
    if (!data) return { nodes: [] as GraphNode[], edges: [] as GraphEdge[] };

    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];
    const nodeSet = new Set<string>();

    const addNode = (id: string, label: string, type: GraphNode['type'], count: number) => {
      if (nodeSet.has(id)) return;
      nodeSet.add(id);
      nodes.push({
        id,
        label,
        type,
        count,
        x: width * 0.2 + Math.random() * width * 0.6,
        y: height * 0.2 + Math.random() * height * 0.6,
        vx: 0,
        vy: 0,
      });
    };

    // Pain nodes
    const painStats = expandPainStats(data.pain_stats);
    painStats.forEach((p) => {
      addNode('pain-' + p.category, PAIN_CATEGORIES[p.category] || p.category, 'pain', p.count);
    });

    // City nodes from pains_by_city
    const painsByCity = expandPainsByGroup(
      data.pains_by_city as { category: string; count: number; city: string }[],
      'city'
    );
    painsByCity.forEach((p) => {
      const cityId = 'city-' + p.group;
      addNode(cityId, p.group, 'city', p.count);
      edges.push({ from: 'pain-' + p.category, to: cityId });
    });

    // Room type nodes
    const painsByRoom = expandPainsByGroup(
      data.pains_by_room as { category: string; count: number; room_type: string }[],
      'room_type'
    );
    painsByRoom.forEach((p) => {
      const roomId = 'room-' + p.group;
      addNode(roomId, p.group, 'room', p.count);
      edges.push({ from: 'pain-' + p.category, to: roomId });
    });

    // Objection nodes
    data.objections.forEach((o) => {
      const objId = 'obj-' + o.reason;
      addNode(objId, LOSS_REASON_LABELS[o.reason] || o.reason, 'objection', Number(o.count));
    });

    // Deduplicate edges
    const edgeSet = new Set<string>();
    const uniqueEdges = edges.filter((e) => {
      const key = e.from + '|' + e.to;
      if (edgeSet.has(key)) return false;
      edgeSet.add(key);
      // Only keep edges where both nodes exist
      return nodeSet.has(e.from) && nodeSet.has(e.to);
    });

    return { nodes, edges: uniqueEdges };
  }, [data]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !data) return;

    const container = canvas.parentElement;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';

    const W = rect.width;
    const H = rect.height;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    const { nodes, edges } = buildGraph(W, H);
    nodesRef.current = nodes;
    edgesRef.current = edges;

    if (nodes.length === 0) return;

    // Build adjacency for quick lookup
    const nodeIndexMap: Record<string, number> = {};
    nodes.forEach((n, i) => { nodeIndexMap[n.id] = i; });

    function simulate() {
      const n = nodes.length;
      // Repulsion
      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          let dx = nodes[j].x - nodes[i].x;
          let dy = nodes[j].y - nodes[i].y;
          let dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const repulse = 3000 / (dist * dist);
          const fx = (dx / dist) * repulse;
          const fy = (dy / dist) * repulse;
          nodes[i].vx -= fx;
          nodes[i].vy -= fy;
          nodes[j].vx += fx;
          nodes[j].vy += fy;
        }
      }

      // Attraction along edges
      for (const edge of edges) {
        const iFrom = nodeIndexMap[edge.from];
        const iTo = nodeIndexMap[edge.to];
        if (iFrom === undefined || iTo === undefined) continue;
        let dx = nodes[iTo].x - nodes[iFrom].x;
        let dy = nodes[iTo].y - nodes[iFrom].y;
        let dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const attract = (dist - 120) * 0.005;
        const fx = (dx / dist) * attract;
        const fy = (dy / dist) * attract;
        nodes[iFrom].vx += fx;
        nodes[iFrom].vy += fy;
        nodes[iTo].vx -= fx;
        nodes[iTo].vy -= fy;
      }

      // Center gravity
      for (let i = 0; i < n; i++) {
        nodes[i].vx += (W / 2 - nodes[i].x) * 0.001;
        nodes[i].vy += (H / 2 - nodes[i].y) * 0.001;
      }

      // Damping + apply velocity
      for (let i = 0; i < n; i++) {
        if (dragRef.current.dragging && dragRef.current.nodeIdx === i) {
          nodes[i].vx = 0;
          nodes[i].vy = 0;
          continue;
        }
        nodes[i].vx *= 0.85;
        nodes[i].vy *= 0.85;
        nodes[i].x += nodes[i].vx;
        nodes[i].y += nodes[i].vy;
        // Bounds
        nodes[i].x = Math.max(40, Math.min(W - 40, nodes[i].x));
        nodes[i].y = Math.max(40, Math.min(H - 40, nodes[i].y));
      }
    }

    function draw() {
      if (!ctx) return;
      ctx.clearRect(0, 0, W, H);

      // Draw edges
      for (const edge of edges) {
        const iFrom = nodeIndexMap[edge.from];
        const iTo = nodeIndexMap[edge.to];
        if (iFrom === undefined || iTo === undefined) continue;
        const fromNode = nodes[iFrom];
        const toNode = nodes[iTo];
        const isHighlighted = hoveredNode && (edge.from === hoveredNode || edge.to === hoveredNode);
        ctx.beginPath();
        ctx.moveTo(fromNode.x, fromNode.y);
        ctx.lineTo(toNode.x, toNode.y);
        ctx.strokeStyle = isHighlighted ? '#6366f1' : '#e5e7eb';
        ctx.lineWidth = isHighlighted ? 2 : 1;
        ctx.stroke();
      }

      // Draw nodes
      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        const radius = Math.min(30, 8 + (node.count || 1) * 2);
        const color = NODE_COLORS[node.type] || '#6b7280';
        const isHovered = hoveredNode === node.id;
        const isConnected = hoveredNode && edges.some(
          (e) => (e.from === hoveredNode && e.to === node.id) || (e.to === hoveredNode && e.from === node.id)
        );
        const dimmed = hoveredNode && !isHovered && !isConnected && hoveredNode !== node.id;

        ctx.beginPath();
        ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = dimmed ? color + '40' : color;
        ctx.fill();

        if (isHovered) {
          ctx.strokeStyle = '#111827';
          ctx.lineWidth = 2;
          ctx.stroke();
        }

        // Label
        ctx.fillStyle = dimmed ? '#9ca3af' : '#111827';
        ctx.font = isHovered ? 'bold 12px Arial' : '11px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(node.label, node.x, node.y + radius + 4);
      }
    }

    function loop() {
      simulate();
      draw();
      animFrameRef.current = requestAnimationFrame(loop);
    }
    loop();

    return () => cancelAnimationFrame(animFrameRef.current);
  }, [data, buildGraph, hoveredNode]);

  // Mouse interactions
  const getNodeAtPos = useCallback((mx: number, my: number): number => {
    const nodes = nodesRef.current;
    for (let i = nodes.length - 1; i >= 0; i--) {
      const node = nodes[i];
      const radius = Math.min(30, 8 + (node.count || 1) * 2);
      const dx = mx - node.x;
      const dy = my - node.y;
      if (dx * dx + dy * dy <= radius * radius) return i;
    }
    return -1;
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    if (dragRef.current.dragging) {
      const node = nodesRef.current[dragRef.current.nodeIdx];
      if (node) {
        node.x = mx;
        node.y = my;
      }
      return;
    }

    const idx = getNodeAtPos(mx, my);
    const nodeId = idx >= 0 ? nodesRef.current[idx].id : null;
    setHoveredNode(nodeId);
    canvas.style.cursor = idx >= 0 ? 'grab' : 'default';
  }, [getNodeAtPos]);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const idx = getNodeAtPos(mx, my);
    if (idx >= 0) {
      dragRef.current = { dragging: true, nodeIdx: idx, offsetX: 0, offsetY: 0 };
      canvas.style.cursor = 'grabbing';
    }
  }, [getNodeAtPos]);

  const handleMouseUp = useCallback(() => {
    dragRef.current = { dragging: false, nodeIdx: -1, offsetX: 0, offsetY: 0 };
  }, []);

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-900 text-sm">Загрузка...</div>
        </div>
      </Layout>
    );
  }

  if (!data) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-900 text-sm">Ошибка загрузки данных</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-[1400px] mx-auto flex flex-col" style={{ height: 'calc(100vh - 120px)' }}>
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <Link href="/marketing/wiki" className="text-sm text-gray-500 hover:text-blue-600 transition mb-1 inline-flex items-center gap-1">
              <span>&larr;</span> Wiki
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">Граф знаний</h1>
          </div>
          {/* Legend */}
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: '#3b82f6' }} />
              <span className="text-gray-900">Боли</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: '#10b981' }} />
              <span className="text-gray-900">Города</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: '#f59e0b' }} />
              <span className="text-gray-900">Помещения</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: '#ef4444' }} />
              <span className="text-gray-900">Возражения</span>
            </div>
          </div>
        </div>

        {/* Canvas */}
        <div className="flex-1 bg-white rounded-xl shadow-sm overflow-hidden relative">
          <canvas
            ref={canvasRef}
            onMouseMove={handleMouseMove}
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            className="w-full h-full"
          />
          {nodesRef.current.length === 0 && !loading && (
            <div className="absolute inset-0 flex items-center justify-center">
              <p className="text-gray-900 text-sm">Нет данных для графа. Добавьте боли клиентов в сделках.</p>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
