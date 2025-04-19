import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useParams } from "react-router-dom";

const SECTIONS = [
  "best_time_to_visit",
  "safety",
  "most_efficient_local_transport",
  "question_of_the_week",
];

type WikiEntry = {
  id: string;
  section: string;
  content: string;
  poll_question: string | null;
  poll_answers: string[] | null;
  poll_votes: { [key: string]: number } | null;
  profile_id: string;
};

const CommunityWiki = () => {
  const { cityId } = useParams<{ cityId: string }>();
  const [wikiData, setWikiData] = useState<Record<string, WikiEntry | null>>({});

  useEffect(() => {
    const fetchData = async () => {
      if (!cityId) return;

      const { data, error } = await supabase
        .from("community_wiki")
        .select("*")
        .eq("city_id", cityId);

      if (error) {
        console.error("Error fetching wiki:", error);
        return;
      }

      const map: Record<string, WikiEntry | null> = {};
      for (const section of SECTIONS) {
        const entry = data?.find((d) => d.section === section) || null;
        map[section] = entry;
      }
      setWikiData(map);
    };

    fetchData();
  }, [cityId]);

  const handleVote = async (section: string, choice: string) => {
    const entry = wikiData[section];
    if (!entry || !entry.poll_votes || !entry.poll_answers?.includes(choice)) return;

    const updatedVotes = { ...entry.poll_votes };
    updatedVotes[choice] = (updatedVotes[choice] || 0) + 1;

    const { error } = await supabase
      .from("community_wiki")
      .update({ poll_votes: updatedVotes })
      .eq("id", entry.id);

    if (error) console.error("Vote error:", error);
    else window.location.reload(); // or setWikiData to avoid reload
  };

  if (!cityId) {
    return <div className="p-4">City ID is missing. Please select a city.</div>;
  }

  return (
    <div className="w-full px-4 ">
    <div className="max-w-4xl bg-blue-50 rounded-xl border border-black shadow-sm py-6 px-6 ml-0">
      <h2 className="text-3xl font-bold mb-8 text-blue-800">🌐 Community Wiki</h2>

      {SECTIONS.map((section) => {
        const entry = wikiData[section];

        return (
          <div key={section} className="mb-10 border-b border-gray-300 pb-6">
            <h3 className="text-xl font-semibold capitalize text-gray-800 mb-2">
              {section.replace(/_/g, " ")}
            </h3>

            <p className="text-gray-700 whitespace-pre-line leading-relaxed">
              {entry?.content || "No information available yet."}
            </p>

            {/* Poll UI */}
            {entry?.poll_question && (
              <div className="mt-6 bg-blue-50 p-5 rounded-xl shadow-sm border border-blue-200">
                <h4 className="font-medium text-lg mb-4 text-blue-900">
                  🗳️ {entry.poll_question}
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {entry.poll_answers?.map((choice) => (
                    <button
                      key={choice}
                      onClick={() => handleVote(section, choice)}
                      className="flex items-center justify-between px-4 py-2 rounded-lg bg-white border border-gray-200 shadow-sm hover:shadow-md transition duration-200"
                    >
                      <span className="text-gray-800 text-sm font-medium">{choice}</span>
                      <span className="text-xs text-white bg-blue-600 px-2 py-1 rounded-full">
                        {entry.poll_votes?.[choice] || 0} votes
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div></div>
  );
};

export default CommunityWiki;
