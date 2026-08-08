---
'@lostgradient/cinder': minor
---

feat!: demote the marketing-section family to documented compositions

BREAKING: ten marketing-section components stop being standalone components
and become documented examples on the primitives they wrap (decision 3 —
reversible by design: the composition logic is relocated, not deleted). No
compatibility aliases — cinder is pre-release.

Removed components (each loses its `./<id>` subpath plus `/schema`,
`/variables`, `/styles`, `/examples`, and its exported types):

| Removed             | Recipe now lives on                             |
| ------------------- | ----------------------------------------------- |
| BlogSection         | `card` — "Blog post grid" example               |
| CallToActionSection | `container` — "Call to action" example          |
| FeatureSection      | `grid` — "Feature grid" example                 |
| HeroSection         | `container` — "Hero section" example            |
| LogoCloud           | `grid` — "Logo cloud" example                   |
| NewsletterSection   | `input` — "Newsletter signup" example           |
| PricingSection      | `pricing-card` — "Pricing section" example      |
| StatisticsSection   | `statistic-group` — "Marketing metrics" example |
| TeamSection         | `card` — "Team roster" example                  |
| TestimonialSection  | `card` — "Testimonial grid" example             |

**Retained**: `PricingCard` and `StatisticGroup` — both carry genuine
behavior (feature de-duplication + selected-state semantics; group
labelling + the compound `StatisticGroup.Statistic` namespace) and stay
first-class.

Migration: replace each removed component with the composition shown in its
host primitive's example. Notable upgrades baked into the recipes: the blog
grid uses the real `Card` component (the old component hand-wrote
`cinder-card` classes), and the statistics recipe passes full
`StatisticChange` objects including the `label` accessibility field the old
flattened `changeValue`/`changeDirection`/`changeDescription` props could
not express. Old container-query breakpoints are re-expressed as intrinsic
`auto-fit` grids, so collapse points now derive from item width rather than
fixed breakpoints.

Also removed: the internal `PersonByline` helper and `section-skeleton.css`
(only this family used them).
