"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import type { DashboardStats } from "@/lib/types"
import { BookOpen, CheckCircle, Clock, XCircle, GraduationCap, Award } from "lucide-react"

interface DashboardStatsCardsProps {
  stats: DashboardStats
}

export function DashboardStatsCards({ stats }: DashboardStatsCardsProps) {
  const cards = [
    {
      title: "Progreso General",
      value: `${stats.progressPercentage}%`,
      icon: GraduationCap,
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
      description: `${stats.completedCourses}/${stats.totalCourses} cursos completados`,
    },
    {
      title: "Créditos Aprobados",
      value: `${stats.completedCredits}/${stats.totalCredits}`,
      icon: Award,
      color: "text-emerald-500",
      bgColor: "bg-emerald-500/10",
      description: "créditos completados",
    },
    {
      title: "Cursos Aprobados",
      value: stats.completedCourses,
      icon: CheckCircle,
      color: "text-emerald-500",
      bgColor: "bg-emerald-500/10",
      description: "completados",
    },
    {
      title: "En Curso",
      value: stats.inProgressCourses,
      icon: Clock,
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
      description: "cursando",
    },
    {
      title: "Reprobados",
      value: stats.failedCourses,
      icon: XCircle,
      color: "text-red-500",
      bgColor: "bg-red-500/10",
      description: "reprobados",
    },
    {
      title: "Semestre Actual",
      value: stats.currentSemester,
      icon: BookOpen,
      color: "text-purple-500",
      bgColor: "bg-purple-500/10",
      description: "semestre en curso",
    },
  ]

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {cards.map((card) => (
        <Card key={card.title}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
            <div className={`p-2 rounded-full ${card.bgColor}`}>
              <card.icon className={`h-4 w-4 ${card.color}`} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{card.value}</div>
            <p className="text-xs text-muted-foreground">{card.description}</p>
            <Progress
              value={stats.progressPercentage}
              className="mt-3 h-1"
            />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

interface CourseStatusChartProps {
  stats: DashboardStats
}

export function CourseStatusChart({ stats }: CourseStatusChartProps) {
  const total = stats.totalCourses || 1
  const data = [
    { name: "Aprobados", value: stats.completedCourses, color: "#10b981" },
    { name: "En Curso", value: stats.inProgressCourses, color: "#3b82f6" },
    { name: "No Cursados", value: stats.notTakenCourses, color: "#71717a" },
    { name: "Reprobados", value: stats.failedCourses, color: "#ef4444" },
    { name: "Retirados", value: stats.withdrawnCourses, color: "#f59e0b" },
  ]

  const maxValue = Math.max(...data.map((d) => d.value))

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Distribución de Cursos</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {data.map((item) => {
            const percentage = Math.round((item.value / total) * 100)
            const width = maxValue > 0 ? (item.value / maxValue) * 100 : 0
            return (
              <div key={item.name} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                    <span>{item.name}</span>
                  </div>
                  <span className="text-muted-foreground">
                    {item.value} ({percentage}%)
                  </span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${width}%`,
                      backgroundColor: item.color,
                    }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
