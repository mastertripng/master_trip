import { Navbar } from "./components/Navbar";
import { Hero } from "./components/Hero";
import { PopularDestinations } from "./components/PopularDestinations";
import { GlobalEducation } from "./components/GlobalEducation";
import { WhyChooseUs } from "./components/WhyChooseUs";
import { TravelInsights } from "./components/TravelInsights";

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-50">
      <Navbar />
      <Hero />
      <PopularDestinations />
      <GlobalEducation />
      <WhyChooseUs />
      <TravelInsights />
    </main>
  );
}
