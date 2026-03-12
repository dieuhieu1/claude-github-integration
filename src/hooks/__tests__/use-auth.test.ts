import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mocks must be declared before imports that use them
vi.mock("next/navigation", () => ({
  useRouter: vi.fn(),
}));

vi.mock("@/actions", () => ({
  signIn: vi.fn(),
  signUp: vi.fn(),
}));

vi.mock("@/lib/anon-work-tracker", () => ({
  getAnonWorkData: vi.fn(),
  clearAnonWork: vi.fn(),
}));

vi.mock("@/actions/get-projects", () => ({
  getProjects: vi.fn(),
}));

vi.mock("@/actions/create-project", () => ({
  createProject: vi.fn(),
}));

import { useRouter } from "next/navigation";
import { signIn as signInAction, signUp as signUpAction } from "@/actions";
import { getAnonWorkData, clearAnonWork } from "@/lib/anon-work-tracker";
import { getProjects } from "@/actions/get-projects";
import { createProject } from "@/actions/create-project";
import { useAuth } from "@/hooks/use-auth";

const mockPush = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useRouter).mockReturnValue({ push: mockPush } as any);
  vi.mocked(getAnonWorkData).mockReturnValue(null);
  vi.mocked(getProjects).mockResolvedValue([]);
  vi.mocked(createProject).mockResolvedValue({ id: "new-project-id" } as any);
});

describe("useAuth", () => {
  describe("initial state", () => {
    it("returns isLoading as false initially", () => {
      const { result } = renderHook(() => useAuth());
      expect(result.current.isLoading).toBe(false);
    });

    it("exposes signIn and signUp functions", () => {
      const { result } = renderHook(() => useAuth());
      expect(typeof result.current.signIn).toBe("function");
      expect(typeof result.current.signUp).toBe("function");
    });
  });

  describe("signIn", () => {
    it("sets isLoading to true during sign in and false after", async () => {
      let resolveSignIn!: (value: any) => void;
      vi.mocked(signInAction).mockReturnValue(
        new Promise((res) => (resolveSignIn = res))
      );

      const { result } = renderHook(() => useAuth());

      let promise: Promise<any>;
      act(() => {
        promise = result.current.signIn("user@example.com", "password123");
      });

      expect(result.current.isLoading).toBe(true);

      await act(async () => {
        resolveSignIn({ success: false, error: "Invalid credentials" });
        await promise;
      });

      expect(result.current.isLoading).toBe(false);
    });

    it("calls signInAction with the provided email and password", async () => {
      vi.mocked(signInAction).mockResolvedValue({ success: false });

      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await result.current.signIn("user@example.com", "password123");
      });

      expect(signInAction).toHaveBeenCalledWith("user@example.com", "password123");
    });

    it("returns the result from signInAction on failure", async () => {
      const failResult = { success: false, error: "Invalid credentials" };
      vi.mocked(signInAction).mockResolvedValue(failResult);

      const { result } = renderHook(() => useAuth());
      let returnValue: any;
      await act(async () => {
        returnValue = await result.current.signIn("user@example.com", "wrong");
      });

      expect(returnValue).toEqual(failResult);
    });

    it("returns the result from signInAction on success", async () => {
      vi.mocked(signInAction).mockResolvedValue({ success: true });
      vi.mocked(getProjects).mockResolvedValue([{ id: "proj-1" } as any]);

      const { result } = renderHook(() => useAuth());
      let returnValue: any;
      await act(async () => {
        returnValue = await result.current.signIn("user@example.com", "password123");
      });

      expect(returnValue).toEqual({ success: true });
    });

    it("does not call handlePostSignIn if signIn fails", async () => {
      vi.mocked(signInAction).mockResolvedValue({ success: false, error: "Bad creds" });

      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await result.current.signIn("user@example.com", "wrong");
      });

      expect(getProjects).not.toHaveBeenCalled();
      expect(createProject).not.toHaveBeenCalled();
      expect(mockPush).not.toHaveBeenCalled();
    });

    it("resets isLoading to false even if signInAction throws", async () => {
      vi.mocked(signInAction).mockRejectedValue(new Error("Network error"));

      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await result.current.signIn("user@example.com", "password123").catch(() => {});
      });

      expect(result.current.isLoading).toBe(false);
    });
  });

  describe("signUp", () => {
    it("sets isLoading to true during sign up and false after", async () => {
      let resolveSignUp!: (value: any) => void;
      vi.mocked(signUpAction).mockReturnValue(
        new Promise((res) => (resolveSignUp = res))
      );

      const { result } = renderHook(() => useAuth());

      let promise: Promise<any>;
      act(() => {
        promise = result.current.signUp("user@example.com", "password123");
      });

      expect(result.current.isLoading).toBe(true);

      await act(async () => {
        resolveSignUp({ success: false, error: "Email already registered" });
        await promise;
      });

      expect(result.current.isLoading).toBe(false);
    });

    it("calls signUpAction with the provided email and password", async () => {
      vi.mocked(signUpAction).mockResolvedValue({ success: false });

      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await result.current.signUp("newuser@example.com", "securepass");
      });

      expect(signUpAction).toHaveBeenCalledWith("newuser@example.com", "securepass");
    });

    it("returns the result from signUpAction on failure", async () => {
      const failResult = { success: false, error: "Email already registered" };
      vi.mocked(signUpAction).mockResolvedValue(failResult);

      const { result } = renderHook(() => useAuth());
      let returnValue: any;
      await act(async () => {
        returnValue = await result.current.signUp("existing@example.com", "pass1234");
      });

      expect(returnValue).toEqual(failResult);
    });

    it("does not call handlePostSignIn if signUp fails", async () => {
      vi.mocked(signUpAction).mockResolvedValue({ success: false });

      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await result.current.signUp("user@example.com", "password");
      });

      expect(getProjects).not.toHaveBeenCalled();
      expect(mockPush).not.toHaveBeenCalled();
    });

    it("resets isLoading to false even if signUpAction throws", async () => {
      vi.mocked(signUpAction).mockRejectedValue(new Error("Server error"));

      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await result.current.signUp("user@example.com", "password123").catch(() => {});
      });

      expect(result.current.isLoading).toBe(false);
    });
  });

  describe("handlePostSignIn — anonymous work exists", () => {
    const anonWork = {
      messages: [{ role: "user", content: "Make a button" }],
      fileSystemData: { "/App.jsx": "export default function App() {}" },
    };

    beforeEach(() => {
      vi.mocked(getAnonWorkData).mockReturnValue(anonWork);
      vi.mocked(signInAction).mockResolvedValue({ success: true });
      vi.mocked(createProject).mockResolvedValue({ id: "anon-project-id" } as any);
    });

    it("creates a project with the anonymous work data", async () => {
      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await result.current.signIn("user@example.com", "password123");
      });

      expect(createProject).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: anonWork.messages,
          data: anonWork.fileSystemData,
        })
      );
    });

    it("uses a time-based name when creating the project", async () => {
      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await result.current.signIn("user@example.com", "password123");
      });

      const callArg = vi.mocked(createProject).mock.calls[0][0];
      expect(callArg.name).toMatch(/^Design from /);
    });

    it("clears anonymous work after creating the project", async () => {
      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await result.current.signIn("user@example.com", "password123");
      });

      expect(clearAnonWork).toHaveBeenCalled();
    });

    it("navigates to the new project", async () => {
      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await result.current.signIn("user@example.com", "password123");
      });

      expect(mockPush).toHaveBeenCalledWith("/anon-project-id");
    });

    it("does not call getProjects when anon work exists", async () => {
      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await result.current.signIn("user@example.com", "password123");
      });

      expect(getProjects).not.toHaveBeenCalled();
    });
  });

  describe("handlePostSignIn — anonymous work has no messages (empty)", () => {
    beforeEach(() => {
      vi.mocked(getAnonWorkData).mockReturnValue({
        messages: [],
        fileSystemData: {},
      });
      vi.mocked(signInAction).mockResolvedValue({ success: true });
    });

    it("falls through to getProjects when anon work messages are empty", async () => {
      vi.mocked(getProjects).mockResolvedValue([{ id: "existing-proj" } as any]);

      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await result.current.signIn("user@example.com", "password123");
      });

      expect(getProjects).toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith("/existing-proj");
    });
  });

  describe("handlePostSignIn — no anonymous work, existing projects", () => {
    beforeEach(() => {
      vi.mocked(getAnonWorkData).mockReturnValue(null);
      vi.mocked(signInAction).mockResolvedValue({ success: true });
    });

    it("navigates to the most recent project", async () => {
      vi.mocked(getProjects).mockResolvedValue([
        { id: "recent-proj" } as any,
        { id: "older-proj" } as any,
      ]);

      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await result.current.signIn("user@example.com", "password123");
      });

      expect(mockPush).toHaveBeenCalledWith("/recent-proj");
    });

    it("does not create a new project when existing projects exist", async () => {
      vi.mocked(getProjects).mockResolvedValue([{ id: "some-proj" } as any]);

      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await result.current.signIn("user@example.com", "password123");
      });

      expect(createProject).not.toHaveBeenCalled();
    });
  });

  describe("handlePostSignIn — no anonymous work, no existing projects", () => {
    beforeEach(() => {
      vi.mocked(getAnonWorkData).mockReturnValue(null);
      vi.mocked(signInAction).mockResolvedValue({ success: true });
      vi.mocked(getProjects).mockResolvedValue([]);
      vi.mocked(createProject).mockResolvedValue({ id: "brand-new-id" } as any);
    });

    it("creates a new empty project", async () => {
      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await result.current.signIn("user@example.com", "password123");
      });

      expect(createProject).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: [],
          data: {},
        })
      );
    });

    it("uses a randomized name for the new project", async () => {
      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await result.current.signIn("user@example.com", "password123");
      });

      const callArg = vi.mocked(createProject).mock.calls[0][0];
      expect(callArg.name).toMatch(/^New Design #\d+$/);
    });

    it("navigates to the newly created project", async () => {
      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await result.current.signIn("user@example.com", "password123");
      });

      expect(mockPush).toHaveBeenCalledWith("/brand-new-id");
    });
  });

  describe("handlePostSignIn — triggered via signUp", () => {
    beforeEach(() => {
      vi.mocked(signUpAction).mockResolvedValue({ success: true });
    });

    it("navigates to existing project after successful sign up", async () => {
      vi.mocked(getAnonWorkData).mockReturnValue(null);
      vi.mocked(getProjects).mockResolvedValue([{ id: "proj-after-signup" } as any]);

      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await result.current.signUp("newuser@example.com", "password123");
      });

      expect(mockPush).toHaveBeenCalledWith("/proj-after-signup");
    });

    it("saves anon work into a project after successful sign up", async () => {
      vi.mocked(getAnonWorkData).mockReturnValue({
        messages: [{ role: "user", content: "hello" }],
        fileSystemData: { "/App.jsx": "..." },
      });
      vi.mocked(createProject).mockResolvedValue({ id: "migrated-project" } as any);

      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await result.current.signUp("newuser@example.com", "password123");
      });

      expect(clearAnonWork).toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith("/migrated-project");
    });
  });
});
