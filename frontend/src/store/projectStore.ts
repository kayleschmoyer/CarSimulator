import { create } from "zustand";
import type { GarageProject, GarageLevel } from "../types/garage";
import { api } from "../lib/api/client";

interface ProjectState {
  projects: GarageProject[];
  activeProject: GarageProject | null;
  loading: boolean;
  error: string | null;

  fetchProjects: () => Promise<void>;
  createProject: (name: string, buildingName?: string) => Promise<GarageProject>;
  setActiveProject: (project: GarageProject) => void;
  uploadLevel: (projectId: string, displayName: string, elevation: number, file: File) => Promise<GarageLevel>;
  refreshLevel: (projectId: string, levelId: string) => Promise<void>;
  updateLevelFeatures: (projectId: string, levelId: string, features: Partial<GarageLevel["features"]>) => Promise<void>;
  markLevelApproved: (projectId: string, levelId: string) => void;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  projects: [],
  activeProject: null,
  loading: false,
  error: null,

  fetchProjects: async () => {
    set({ loading: true, error: null });
    try {
      const projects = await api.get<GarageProject[]>("/projects");
      set({ projects, loading: false });
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },

  createProject: async (name, buildingName = "") => {
    const project = await api.post<GarageProject>("/projects", { name, building_name: buildingName });
    set((s) => ({ projects: [...s.projects, project], activeProject: project }));
    return project;
  },

  setActiveProject: (project) => set({ activeProject: project }),

  uploadLevel: async (projectId, displayName, elevation, file) => {
    const form = new FormData();
    form.append("display_name", displayName);
    form.append("floor_elevation", String(elevation));
    form.append("file", file);

    const level = await api.postForm<GarageLevel>(`/projects/${projectId}/levels`, form);

    set((s) => {
      if (!s.activeProject || s.activeProject.id !== projectId) return s;
      return {
        activeProject: {
          ...s.activeProject,
          levels: [...s.activeProject.levels, level],
        },
      };
    });

    return level;
  },

  refreshLevel: async (projectId, levelId) => {
    const level = await api.get<GarageLevel>(`/projects/${projectId}/levels/${levelId}`);
    set((s) => {
      if (!s.activeProject || s.activeProject.id !== projectId) return s;
      return {
        activeProject: {
          ...s.activeProject,
          levels: s.activeProject.levels.map((l) => (l.id === levelId ? level : l)),
        },
      };
    });
  },

  updateLevelFeatures: async (projectId, levelId, features) => {
    const updated = await api.patch<GarageLevel>(
      `/projects/${projectId}/levels/${levelId}/features`,
      features
    );
    set((s) => {
      if (!s.activeProject || s.activeProject.id !== projectId) return s;
      return {
        activeProject: {
          ...s.activeProject,
          levels: s.activeProject.levels.map((l) => (l.id === levelId ? updated : l)),
        },
      };
    });
  },

  markLevelApproved: (projectId, levelId) => {
    set((s) => {
      if (!s.activeProject || s.activeProject.id !== projectId) return s;
      return {
        activeProject: {
          ...s.activeProject,
          levels: s.activeProject.levels.map((l) =>
            l.id === levelId ? { ...l, parse_status: "complete" as const } : l
          ),
        },
      };
    });
  },
}));
