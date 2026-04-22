"use client"

import { useCallback, useEffect, useMemo, useRef } from "react"
import {
  BaseEdge,
  ReactFlow,
  Background,
  Handle,
  Position,
  MarkerType,
  getSmoothStepPath,
  type Node,
  type Edge,
  type EdgeProps,
  type ReactFlowInstance,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import { CourseCard } from "@/components/course-card"
import type { Course } from "@/lib/types"
import { cn } from "@/lib/utils"

/* ------------------------------------------------------------------ */
/*  Node types                                                          */
/* ------------------------------------------------------------------ */

type CourseNodeData = {
  course: Course
  isCentral?: boolean
  showLeftHandle?: boolean
  showRightHandle?: boolean
  showTopHandle?: boolean
  showBottomHandle?: boolean
}

type RelationType = "prerequisite" | "corequisite" | "postrequisite"
type RelationEdgeData = {
  relation: RelationType
}

const NODE_WIDTH = 192
const NODE_HEIGHT = 92
const VERTICAL_GAP = 28
const COREQUISITE_VERTICAL_GAP = 56
const HORIZONTAL_GAP = 132

const RELATION_COLORS: Record<RelationType, string> = {
  prerequisite: "#f59e0b",
  corequisite: "#3b82f6",
  postrequisite: "#10b981",
}

function CourseFlowNode({ data }: { data: CourseNodeData }) {
  const {
    course,
    isCentral,
    showLeftHandle,
    showRightHandle,
    showTopHandle,
    showBottomHandle,
  } = data

  return (
    <div className={cn("relative w-48", isCentral && "z-10")}>
      {showLeftHandle ? (
        <Handle
          type="target"
          position={Position.Left}
          className="!size-2.5 !bg-border !border-none"
          id="left"
        />
      ) : null}
      {showRightHandle ? (
        <Handle
          type="source"
          position={Position.Right}
          className="!size-2.5 !bg-border !border-none"
          id="right"
        />
      ) : null}
      {showTopHandle ? (
        <Handle
          type="target"
          position={Position.Top}
          className="!size-2.5 !bg-border !border-none"
          id="top"
        />
      ) : null}
      {showBottomHandle ? (
        <Handle
          type="source"
          position={Position.Bottom}
          className="!size-2.5 !bg-border !border-none"
          id="bottom"
        />
      ) : null}

      <CourseCard course={course} isHovered={false} />
    </div>
  )
}

function RelationEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  markerEnd,
}: EdgeProps<Edge<RelationEdgeData>>) {
  const relation = data?.relation ?? "prerequisite"
  const color = RELATION_COLORS[relation]
  const [path] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    borderRadius: 14,
    offset: 20,
  })

  return (
    <BaseEdge
      id={id}
      path={path}
      markerEnd={markerEnd}
      style={{
        stroke: color,
        strokeWidth: 2.5,
      }}
    />
  )
}

const nodeTypes = {
  course: CourseFlowNode,
}

const edgeTypes = {
  relation: RelationEdge,
}

/* ------------------------------------------------------------------ */
/*  Main component                                                      */
/* ------------------------------------------------------------------ */

interface CourseRelationFlowProps {
  course: Course
  prerequisites: Course[]
  corequisites: Course[]
  dependents: Course[]
}

export function CourseRelationFlow({
  course,
  prerequisites,
  corequisites,
  dependents,
}: CourseRelationFlowProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const flowInstanceRef = useRef<
    ReactFlowInstance<Node<CourseNodeData>, Edge<RelationEdgeData>> | null
  >(null)

  const fitFlow = useCallback(() => {
    const instance = flowInstanceRef.current
    if (!instance) return

    requestAnimationFrame(() => {
      void instance.fitView({ padding: 0.24, minZoom: 0.1 })
    })
  }, [])

  const { nodes, edges } = useMemo(() => {
    const nodeList: Node<CourseNodeData>[] = []
    const edgeList: Edge<RelationEdgeData>[] = []
    const stepY = NODE_HEIGHT + VERTICAL_GAP
    const corequisiteStepY = NODE_HEIGHT + COREQUISITE_VERTICAL_GAP
    const columnStep = NODE_WIDTH + HORIZONTAL_GAP
    const leftX = 0
    const middleX = columnStep
    const rightX = columnStep * 2

    const mainRows = Math.max(prerequisites.length, dependents.length, 1)
    const centralRow = Math.floor((mainRows - 1) / 2)
    const centralY = 0

    const getArrow = (relation: RelationType) => ({
      type: MarkerType.ArrowClosed,
      color: RELATION_COLORS[relation],
      width: 16,
      height: 16,
    })

    nodeList.push({
      id: "central",
      type: "course",
      position: { x: middleX, y: centralY },
      data: {
        course,
        isCentral: true,
        showLeftHandle: prerequisites.length > 0,
        showRightHandle: dependents.length > 0,
        showBottomHandle: corequisites.length > 0,
      },
    })

    prerequisites.forEach((prereq, index) => {
      const id = `prereq-${prereq.id}`
      const y = (index - centralRow) * stepY

      nodeList.push({
        id,
        type: "course",
        position: { x: leftX, y },
        data: { course: prereq, showRightHandle: true },
      })

      edgeList.push({
        id: `e-${id}-central`,
        source: id,
        target: "central",
        sourceHandle: "right",
        targetHandle: "left",
        type: "relation",
        data: { relation: "prerequisite" },
        markerEnd: getArrow("prerequisite"),
      })
    })

    dependents.forEach((dep, index) => {
      const id = `dep-${dep.id}`
      const y = (index - centralRow) * stepY

      nodeList.push({
        id,
        type: "course",
        position: { x: rightX, y },
        data: { course: dep, showLeftHandle: true },
      })

      edgeList.push({
        id: `e-central-${id}`,
        source: "central",
        target: id,
        sourceHandle: "right",
        targetHandle: "left",
        type: "relation",
        data: { relation: "postrequisite" },
        markerEnd: getArrow("postrequisite"),
      })
    })

    corequisites.forEach((coreq, index) => {
      const id = `coreq-${coreq.id}`
      const y = centralY + (index + 1) * corequisiteStepY

      nodeList.push({
        id,
        type: "course",
        position: { x: middleX, y },
        data: { course: coreq, showTopHandle: true },
      })

      edgeList.push({
        id: `e-central-${id}`,
        source: "central",
        target: id,
        sourceHandle: "bottom",
        targetHandle: "top",
        type: "relation",
        data: { relation: "corequisite" },
        markerEnd: getArrow("corequisite"),
      })
    })

    if (nodeList.length > 0) {
      const minX = Math.min(...nodeList.map((node) => node.position.x))
      const maxX = Math.max(...nodeList.map((node) => node.position.x + NODE_WIDTH))
      const minY = Math.min(...nodeList.map((node) => node.position.y))
      const maxY = Math.max(...nodeList.map((node) => node.position.y + NODE_HEIGHT))
      const offsetX = (minX + maxX) / 2
      const offsetY = (minY + maxY) / 2

      nodeList.forEach((node) => {
        node.position = {
          x: node.position.x - offsetX,
          y: node.position.y - offsetY,
        }
      })
    }

    return { nodes: nodeList, edges: edgeList }
  }, [course, prerequisites, corequisites, dependents])

  useEffect(() => {
    fitFlow()
  }, [fitFlow, nodes, edges])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    let rafId = 0
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(rafId)
      rafId = requestAnimationFrame(() => {
        fitFlow()
      })
    })

    observer.observe(el)

    return () => {
      cancelAnimationFrame(rafId)
      observer.disconnect()
    }
  }, [fitFlow])

  return (
    <div
      ref={containerRef}
      className="w-full aspect-[3/2] min-h-[240px] max-h-[500px] overflow-hidden rounded-xl border border-border bg-card/30"
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={{ padding: 0.24, minZoom: 0.1 }}
        onInit={(instance) => {
          flowInstanceRef.current = instance
          fitFlow()
        }}
        minZoom={0.1}
        maxZoom={2}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        nodesFocusable={false}
        edgesFocusable={false}
        zoomOnScroll={false}
        zoomOnPinch={false}
        zoomOnDoubleClick={false}
        panOnDrag={false}
        panOnScroll={false}
        preventScrolling={false}
        attributionPosition="bottom-right"
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={16} size={1} color="hsl(var(--border))" />
      </ReactFlow>
    </div>
  )
}
