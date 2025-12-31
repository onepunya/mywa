<template>
   <div id="pricing" class="pricing-section py-4">
      <div class="container">
         <div class="text-center mb-5">
            <h2 class="main-title mb-3">Choose The Right Plan For You</h2>
            <p class="section-subtitle">Start for free, then upgrade as your business grows.</p>
         </div>

         <div class="pricing-container">
            <swiper v-if="useSlider" :modules="modules" :slides-per-view="slidesPerView" :space-between="24"
               :pagination="{ clickable: true }" class="pricing-swiper pb-5">
               <swiper-slide v-for="plan in priceList" :key="plan.code">
                  <div class="pricing-card h-100 d-flex flex-column rounded-3" :class="{ 'popular': plan.popular }">
                     <div class="card-body-custom d-flex flex-column flex-grow-1 p-4">
                        <div class="card-header-section">
                           <p v-if="plan.popular" class="popular-label">Most Popular</p>
                           <h3 class="plan-name">{{ plan.name }}</h3>
                           <p class="plan-description">{{ plan.description }}</p>
                           <div class="price-display mt-3">
                              <span v-if="plan.price > 0" class="price-currency">{{ currencySymbol }}</span>
                              <span class="price-value">{{ formatPrice(plan.price) }}</span>
                           </div>
                        </div>
                        <ul class="features-list list-unstyled my-4">
                           <li class="feature-item"><i class="bi bi-calendar-check feature-icon"></i><span><strong>{{
                              plan.days }}</strong> Days Active</span></li>
                           <li class="feature-item"><i class="bi bi-person-check feature-icon"></i><span><strong>{{
                              plan.owner }}</strong> Owner Number{{ plan.owner > 1 ? 's' : '' }}</span></li>
                           <li class="feature-item"><i class="bi bi-cpu feature-icon"></i><span><strong>{{
                              (plan.response / 1000) }}K</strong> Responses</span></li>
                           <li class="feature-item">
                              <i v-if="plan.customize" class="bi bi-check-lg feature-icon text-success-custom"></i>
                              <i v-else class="bi bi-x-lg feature-icon text-muted"></i>
                              <span>Customization</span>
                           </li>
                           <li class="feature-item">
                              <i v-if="!plan.ads" class="bi bi-shield-check feature-icon text-success-custom"></i>
                              <i v-else class="bi bi-badge-ad feature-icon"></i>
                              <span>{{ plan.ads ? 'Includes Ads' : 'No Ads' }}</span>
                           </li>
                        </ul>
                        <div class="mt-auto">
                           <button class="btn w-100 py-2"
                              :class="plan.popular ? 'btn-custom-accent' : 'btn-outline-accent'"
                              @click="handlePlanSelection(plan)">{{ plan.price === 0 ? 'Start for Free' : 'Choose Plan'
                              }}</button>
                        </div>
                     </div>
                  </div>
               </swiper-slide>
            </swiper>

            <div v-else class="row g-4 justify-content-center">
               <div v-for="plan in priceList" :key="plan.code" class="col-lg-4 col-md-6">
                  <div class="pricing-card h-100 d-flex flex-column rounded-3" :class="{ 'popular': plan.popular }">
                     <div class="card-body-custom d-flex flex-column flex-grow-1 p-4">
                        <div class="card-header-section">
                           <p v-if="plan.popular" class="popular-label">Most Popular</p>
                           <h3 class="plan-name">{{ plan.name }}</h3>
                           <p class="plan-description">{{ plan.description }}</p>
                           <div class="price-display mt-3">
                              <span v-if="plan.price > 0" class="price-currency">{{ currencySymbol }}</span>
                              <span class="price-value">{{ formatPrice(plan.price) }}</span>
                           </div>
                        </div>
                        <ul class="features-list list-unstyled my-4">
                           <li class="feature-item"><i class="bi bi-calendar-check feature-icon"></i><span><strong>{{
                              plan.days }}</strong> Days Active</span></li>
                           <li class="feature-item"><i class="bi bi-person-check feature-icon"></i><span><strong>{{
                              plan.owner }}</strong> Owner Number{{ plan.owner > 1 ? 's' : '' }}</span></li>
                           <li class="feature-item"><i class="bi bi-cpu feature-icon"></i><span><strong>{{
                              (plan.response / 1000) }}K</strong> Responses</span></li>
                           <li class="feature-item">
                              <i v-if="plan.customize" class="bi bi-check-lg feature-icon text-success-custom"></i>
                              <i v-else class="bi bi-x-lg feature-icon text-muted"></i>
                              <span>Customization</span>
                           </li>
                           <li class="feature-item">
                              <i v-if="!plan.ads" class="bi bi-shield-check feature-icon text-success-custom"></i>
                              <i v-else class="bi bi-badge-ad feature-icon"></i>
                              <span>{{ plan.ads ? 'Includes Ads' : 'No Ads' }}</span>
                           </li>
                        </ul>
                        <div class="mt-auto">
                           <button class="btn w-100 py-2"
                              :class="plan.popular ? 'btn-custom-accent' : 'btn-outline-accent'"
                              @click="handlePlanSelection(plan)">{{ plan.price === 0 ? 'Start for Free' : 'Choose Plan'
                              }}</button>
                        </div>
                     </div>
                  </div>
               </div>
            </div>
         </div>
      </div>
   </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import Swal from 'sweetalert2'
import { Swiper, SwiperSlide } from 'swiper/vue'
import { Pagination } from 'swiper/modules'
import 'swiper/css'
import 'swiper/css/pagination'

const router = useRouter()
const config = useRuntimeConfig()
const priceList = ref(config.public.price_list || [])
const windowWidth = ref(0)

const modules = [Pagination]

const useSlider = computed(() => {
   return windowWidth.value < 992 || priceList.value.length > 3
})

const slidesPerView = computed(() => {
   if (windowWidth.value < 768) return 1
   if (windowWidth.value < 992) return 2.2
   return 3
})

const updateWidth = () => {
   if (typeof window !== 'undefined') {
      windowWidth.value = window.innerWidth
   }
}

onMounted(() => {
   updateWidth()
   window.addEventListener('resize', updateWidth)
})

onUnmounted(() => {
   window.removeEventListener('resize', updateWidth)
})

const currencySymbol = computed(() => {
   try {
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: config.public.currency || 'IDR' }).formatToParts(1).find(part => part.type === 'currency').value
   } catch {
      return '$'
   }
})

const formatPrice = (price) => {
   if (price === 0) return 'Free'
   return new Intl.NumberFormat('en-US').format(price)
}

const handlePlanSelection = (plan) => {
   if (plan.code === 'trial') {
      router.push('/auth/login')
   } else {
      const whatsappLink = `https://wa.me/${config.public.owner}?text=Hello, I'm interested in the *${plan.name}* plan.`
      Swal.fire({
         title: 'Contact Owner',
         html: `To purchase the <strong>${plan.name}</strong> plan, contact the owner via WhatsApp.`,
         icon: 'info',
         showCancelButton: true,
         confirmButtonText: 'Contact on WhatsApp',
         cancelButtonText: 'Cancel',
         reverseButtons: true,
      }).then((result) => {
         if (result.isConfirmed) {
            window.open(whatsappLink, '_blank')
         }
      })
   }
}
</script>

<style scoped>
:deep(.swiper-pagination-bullet) {
   background-color: var(--dark-border-color);
   opacity: 1;
}

:deep(.swiper-pagination-bullet-active) {
   background-color: var(--dark-primary-accent);
}

body.light-mode :deep(.swiper-pagination-bullet) {
   background-color: var(--light-border-color);
}

body.light-mode :deep(.swiper-pagination-bullet-active) {
   background-color: var(--light-primary);
}

.swiper-slide {
   height: auto;
   display: flex;
   padding-top: 15px
}

.pricing-swiper {
   transform: translateZ(0); 
   -webkit-transform: translateZ(0);
   will-change: transform; 
   backface-visibility: hidden;
   -webkit-backface-visibility: hidden;
   z-index: 1; 
}

.pricing-card {
   background-color: var(--dark-card-bg);
   border: 1px solid var(--dark-border-color);
   border-top: 4px solid transparent;
   transition: transform 0.3s ease, border-color 0.3s ease;
   position: relative;
   width: 100%;
}

body.light-mode .pricing-card {
   background-color: var(--light-card-bg);
   border-color: var(--light-border-color);
}

.pricing-card:hover {
   transform: translateY(-5px);
   border-color: var(--dark-border-color);
}

body.light-mode .pricing-card:hover {
   border-color: var(--light-border-color);
}

.pricing-card.popular {
   border-top-color: var(--dark-primary-accent);
}

body.light-mode .pricing-card.popular {
   border-top-color: var(--light-primary);
}

.pricing-card.popular:hover {
   border-color: var(--dark-border-color);
   border-top-color: var(--dark-primary-accent);
}

body.light-mode .pricing-card.popular:hover {
   border-color: var(--light-border-color);
   border-top-color: var(--light-primary);
}

.popular-label {
   color: var(--dark-primary-accent);
   font-size: 0.8rem;
   font-weight: 700;
   text-transform: uppercase;
   letter-spacing: 0.05em;
   margin-bottom: 0.5rem;
}

body.light-mode .popular-label {
   color: var(--light-primary);
}

.section-subtitle {
   font-size: 1.1rem;
   color: var(--dark-secondary-text-color);
}

body.light-mode .section-subtitle {
   color: #6c757d;
}

.plan-name {
   font-size: 1.5rem;
   font-weight: 600;
   color: var(--dark-text-color);
}

body.light-mode .plan-name {
   color: var(--light-text-color);
}

.plan-description {
   font-size: 0.9rem;
   color: var(--dark-secondary-text-color);
   min-height: 40px;
}

body.light-mode .plan-description {
   color: #6c757d;
}

.price-display {
   display: flex;
   align-items: baseline;
   justify-content: flex-start;
   text-align: left;
   color: var(--dark-text-color);
   padding: 0;
   border: none;
}

body.light-mode .price-display {
   color: var(--light-text-color);
}

.price-currency {
   font-size: 1.1rem;
   font-weight: 500;
   margin-right: 0.25rem;
}

.price-value {
   font-size: 2.25rem;
   font-weight: 700;
   line-height: 1;
}

.btn-outline-accent {
   border: 2px solid var(--dark-border-color);
   color: var(--dark-text-color);
   font-weight: 600;
}

.btn-outline-accent:hover {
   border-color: var(--dark-primary-accent);
   background-color: var(--dark-primary-accent);
   color: #000;
}

body.light-mode .btn-outline-accent {
   border-color: var(--light-border-color);
   color: var(--light-text-color);
}

body.light-mode .btn-outline-accent:hover {
   border-color: var(--light-primary);
   background-color: var(--light-primary);
   color: #fff;
}

.features-list {
   padding: 0;
   padding-top: 1.5rem;
   border-top: 1px solid var(--dark-border-color);
}

body.light-mode .features-list {
   border-color: var(--light-border-color);
}

.feature-item {
   display: flex;
   align-items: center;
   margin-bottom: 0.85rem;
   font-size: 0.9rem;
   color: var(--dark-secondary-text-color);
}

body.light-mode .feature-item {
   color: #495057;
}

.feature-item strong {
   color: var(--dark-text-color);
   margin-right: 0.3rem;
}

body.light-mode .feature-item strong {
   color: var(--light-text-color);
}

.feature-icon {
   font-size: 1.1rem;
   width: 24px;
   text-align: center;
   margin-right: 0.75rem;
   color: var(--dark-secondary-text-color);
}

.text-success-custom {
   color: var(--dark-primary-accent) !important;
}

body.light-mode .text-success-custom {
   color: #198754 !important;
}
</style>