<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { activeNavigationModule, matchesNavigationPath, visibleNavigation, type VisibleNavigationModule, type VisibleNavigationRoute } from '@/manifest'
import { allowsPermission } from '@/framework/adapters/bundle'
import { navigationAudience } from '@/framework/audience'
import Icon from '@southneuhof/loom/components/base/Icon.vue'
import ProfileSegment from '../../layouts/ProfileSegment.vue'

const route = useRoute()
const router = useRouter()
type SidebarNavigationModule = VisibleNavigationModule & { directRoute: VisibleNavigationRoute | undefined }

function getDirectRoute(module: VisibleNavigationModule) {
  const [entry] = module.routes
  return module.routes.length === 1 && entry && !('separator' in entry) ? entry : undefined
}

const navigation = computed<SidebarNavigationModule[]>(() => visibleNavigation(allowsPermission, navigationAudience()).map((module) => ({ ...module, directRoute: getDirectRoute(module) })))
const activeModule = computed(() => activeNavigationModule(route.path, (to) => router.resolve(to as never), allowsPermission, navigationAudience()))
const openGroups = ref(new Set<string>())
const navigationElement = ref<HTMLElement>()
const showTopFade = ref(false)
const showBottomFade = ref(false)

function toggleGroup(name: string) {
  const groups = new Set(openGroups.value)
  if (groups.has(name)) groups.delete(name)
  else groups.add(name)
  openGroups.value = groups
  void nextTick(updateScrollFades)
}

function isGroupOpen(name: string) {
  return openGroups.value.has(name)
}

function isActiveRoute(moduleName: string, routeName: string, to: unknown) {
  return routeName === String(route.name) || (moduleName === activeModule.value && matchesNavigationPath(route.path, router.resolve(to as never).path))
}

function beforeEnter(element: Element) {
  const node = element as HTMLElement
  node.style.height = '0'
}

function enter(element: Element) {
  const node = element as HTMLElement
  void node.offsetHeight
  node.style.height = `${node.scrollHeight}px`
}

function afterEnter(element: Element) {
  const node = element as HTMLElement
  node.style.height = 'auto'
}

function beforeLeave(element: Element) {
  const node = element as HTMLElement
  node.style.height = `${node.scrollHeight}px`
}

function leave(element: Element) {
  const node = element as HTMLElement
  void node.offsetHeight
  node.style.height = '0'
}

function afterLeave(element: Element) {
  const node = element as HTMLElement
  node.style.height = ''
}

function updateScrollFades() {
  const element = navigationElement.value
  if (!element) return
  showTopFade.value = element.scrollTop > 4
  showBottomFade.value = element.scrollTop + element.clientHeight < element.scrollHeight - 4
}

watch(
  navigation,
  (modules) => {
    const groups = new Set(openGroups.value)
    for (const module of modules) groups.add(module.name)
    openGroups.value = groups
    void nextTick(updateScrollFades)
  },
  { immediate: true }
)

watch(activeModule, (module) => {
  if (!module) return
  const groups = new Set(openGroups.value)
  groups.add(module)
  openGroups.value = groups
})

onMounted(() => {
  updateScrollFades()
  window.addEventListener('resize', updateScrollFades)
})

onBeforeUnmount(() => window.removeEventListener('resize', updateScrollFades))
</script>

<template>
  <aside
    class="relative hidden min-h-0 h-full w-full text-on-surface lg:block"
    style="--sidebar-scroll-fade-height: 72px; --sidebar-scroll-fade-blur: 6px; --sidebar-scroll-fade-color: rgb(var(--md-sys-color-surface-container-low))"
  >
    <div class="relative h-full">
      <div v-if="showTopFade" class="sidebar-scroll-fade sidebar-scroll-fade--top" aria-hidden="true" />
      <nav ref="navigationElement" aria-label="Main navigation" class="absolute inset-0 z-0 overflow-y-auto px-3 pt-16 pb-[72px]" @scroll="updateScrollFades">
        <section v-for="module in navigation" :key="module.name" class="mb-2">
          <RouterLink
            v-if="module.directRoute"
            :to="module.directRoute.to as never"
            class="overlay flex min-h-10 w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-on-surface-variant outline-none focus-visible:ring-2 focus-visible:ring-primary"
            :class="
              isActiveRoute(module.name, module.directRoute.name, module.directRoute.to)
                ? 'bg-primary-container text-on-primary-container shadow-sm after:bg-on-primary-container-hover focus-visible:after:bg-on-primary-container-active active:after:bg-on-primary-container-active'
                : 'after:bg-on-surface-variant-hover focus-visible:after:bg-on-surface-variant-active active:after:bg-on-surface-variant-active'
            "
          >
            <Icon :name="module.directRoute.icon" size="lg" class="shrink-0" />
            <span class="min-w-0 truncate">{{ module.directRoute.title }}</span>
          </RouterLink>

          <template v-else>
            <button
              type="button"
              class="overlay flex min-h-10 w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-medium text-on-surface-variant outline-none after:bg-on-surface-variant-hover focus-visible:ring-2 focus-visible:ring-primary focus-visible:after:bg-on-surface-variant-active active:after:bg-on-surface-variant-active"
              :aria-expanded="isGroupOpen(module.name)"
              :aria-controls="`sidebar-group-${module.name}`"
              @click="toggleGroup(module.name)"
            >
              <Icon :name="module.icon" size="lg" class="shrink-0" />
              <span class="min-w-0 flex-1 truncate">{{ module.title }}</span>
              <Icon size="sm" :name="isGroupOpen(module.name) ? 'arrow-up-s' : 'arrow-down-s'" class="shrink-0" />
            </button>

            <Transition name="sidebar-collapse" @before-enter="beforeEnter" @enter="enter" @after-enter="afterEnter" @before-leave="beforeLeave" @leave="leave" @after-leave="afterLeave">
              <div v-if="isGroupOpen(module.name)" :id="`sidebar-group-${module.name}`" class="space-y-1 overflow-hidden">
                <div class="h-1"></div>
                <template v-for="entry in module.routes" :key="entry.name">
                  <p v-if="'separator' in entry" class="ml-3 px-3 pb-1 pt-2 text-xs font-medium text-on-surface-variant">{{ entry.name }}</p>
                  <RouterLink
                    v-else
                    :to="entry.to as never"
                    class="overlay ml-3 flex min-h-10 items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-on-surface-variant outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    :class="
                      isActiveRoute(module.name, entry.name, entry.to)
                        ? 'bg-primary-container text-on-primary-container shadow-sm after:bg-on-primary-container-hover focus-visible:after:bg-on-primary-container-active active:after:bg-on-primary-container-active'
                        : 'after:bg-on-surface-variant-hover focus-visible:after:bg-on-surface-variant-active active:after:bg-on-surface-variant-active'
                    "
                  >
                    <Icon :name="entry.icon" size="lg" class="shrink-0" />
                    <span class="min-w-0 truncate">{{ entry.title }}</span>
                  </RouterLink>
                </template>
              </div>
            </Transition>
          </template>
        </section>
      </nav>
      <div v-if="showBottomFade" class="sidebar-scroll-fade sidebar-scroll-fade--bottom" aria-hidden="true" />
    </div>

    <div class="pointer-events-none absolute inset-x-0 bottom-0 z-[2] p-4 pt-2">
      <div class="pointer-events-auto">
        <ProfileSegment />
      </div>
    </div>
  </aside>
</template>

<style scoped>
.sidebar-scroll-fade {
  position: absolute;
  inset-inline: 0;
  z-index: 1;
  height: var(--sidebar-scroll-fade-height);
  pointer-events: none;
  backdrop-filter: blur(var(--sidebar-scroll-fade-blur));
  -webkit-backdrop-filter: blur(var(--sidebar-scroll-fade-blur));
}

.sidebar-scroll-fade--top {
  top: 0;
  background: linear-gradient(to bottom, var(--sidebar-scroll-fade-color), transparent);
  mask-image: linear-gradient(to bottom, var(--sidebar-scroll-fade-color) 50%, transparent);
  -webkit-mask-image: linear-gradient(to bottom, var(--sidebar-scroll-fade-color) 50%, transparent);
}

.sidebar-scroll-fade--bottom {
  bottom: 0;
  background: linear-gradient(to top, var(--sidebar-scroll-fade-color), transparent);
  mask-image: linear-gradient(to top, var(--sidebar-scroll-fade-color) 50%, transparent);
  -webkit-mask-image: linear-gradient(to top, var(--sidebar-scroll-fade-color) 50%, transparent);
}

.sidebar-collapse-enter-active,
.sidebar-collapse-leave-active {
  overflow: hidden;
  transition: height 180ms cubic-bezier(0.16, 1, 0.3, 1);
}

@media (prefers-reduced-motion: reduce) {
  .sidebar-collapse-enter-active,
  .sidebar-collapse-leave-active {
    transition-duration: 0.01ms;
  }
}
</style>
