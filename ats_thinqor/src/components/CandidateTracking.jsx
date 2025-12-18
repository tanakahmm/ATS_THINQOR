import { useDispatch } from "react-redux";
import { fetchCandidateProgressDetails } from "../auth/authSlice";

export default function CandidateTracking() {
  const dispatch = useDispatch();
  const { candidateId, requirementId } = useParams();
  const navigate = useNavigate();
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchProgress = async () => {
      try {
        setLoading(true);
        const data = await dispatch(
          fetchCandidateProgressDetails({ candidateId, requirementId })
        ).unwrap();
        setDetails(data);
      } catch (err) {
        console.error("Progress fetch error:", err);
        setError(err || "Unable to load candidate tracking.");
      } finally {
        setLoading(false);
      }
    };

    if (candidateId && requirementId) {
      fetchProgress();
    }
  }, [candidateId, requirementId, dispatch]);

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Candidate Tracking</h1>
          <button
            onClick={() => navigate(-1)}
            className="px-4 py-2 bg-purple-600 rounded-lg hover:bg-purple-700"
          >
            ← Back
          </button>
        </div>

        {loading ? (
          <div className="text-center text-gray-300 py-10">
            Loading tracking details...
          </div>
        ) : error ? (
          <div className="bg-red-500/20 border border-red-500/40 text-red-200 px-4 py-3 rounded-lg">
            {error}
          </div>
        ) : details ? (
          <div className="space-y-6">
            <section className="bg-gray-800/60 border border-purple-500/30 rounded-xl p-5">
              <h2 className="text-xl font-semibold mb-3">Candidate</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-gray-300 text-sm">
                <p>
                  <span className="text-gray-400">Name:</span>{" "}
                  {details.candidate?.name}
                </p>
                <p>
                  <span className="text-gray-400">Email:</span>{" "}
                  {details.candidate?.email}
                </p>
                <p>
                  <span className="text-gray-400">Phone:</span>{" "}
                  {details.candidate?.phone || "--"}
                </p>
                <p>
                  <span className="text-gray-400">Experience:</span>{" "}
                  {details.candidate?.experience || "--"}
                </p>
              </div>
            </section>

            <section className="bg-gray-800/60 border border-purple-500/30 rounded-xl p-5">
              <h2 className="text-xl font-semibold mb-3">Requirement</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-gray-300 text-sm">
                <p>
                  <span className="text-gray-400">Title:</span>{" "}
                  {details.requirement?.title}
                </p>
                <p>
                  <span className="text-gray-400">Location:</span>{" "}
                  {details.requirement?.location || "--"}
                </p>
                <p>
                  <span className="text-gray-400">Category:</span>{" "}
                  {details.requirement?.category || "--"}
                </p>
                <p>
                  <span className="text-gray-400">Requirement ID:</span>{" "}
                  {details.requirement?.id}
                </p>
              </div>
            </section>

            <section className="bg-gray-800/60 border border-purple-500/30 rounded-xl p-5">
              <h2 className="text-xl font-semibold mb-3">Progress</h2>
              {details.progress ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-gray-300 text-sm">
                  <p>
                    <span className="text-gray-400">Current Stage:</span>{" "}
                    {details.progress.current_stage}
                  </p>
                  <p>
                    <span className="text-gray-400">Status:</span>{" "}
                    {details.progress.status}
                  </p>
                  <p>
                    <span className="text-gray-400">Manual Decision:</span>{" "}
                    {details.progress.manual_decision}
                  </p>
                  <p>
                    <span className="text-gray-400">Updated:</span>{" "}
                    {details.progress.updated_at
                      ? new Date(details.progress.updated_at).toLocaleString()
                      : "--"}
                  </p>
                </div>
              ) : (
                <p className="text-gray-400 text-sm">
                  No progress recorded yet.
                </p>
              )}
            </section>

            <section className="bg-gray-800/60 border border-purple-500/30 rounded-xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">AI Screening</h2>
                {details.screening && (
                  <span className="text-sm text-gray-400">
                    {details.screening.created_at
                      ? new Date(details.screening.created_at).toLocaleString()
                      : ""}
                  </span>
                )}
              </div>

              {details.screening ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-300">
                  <p>
                    <span className="text-gray-400">Score:</span>{" "}
                    {details.screening.ai_score}
                  </p>
                  <p>
                    <span className="text-gray-400">Recommendation:</span>{" "}
                    {details.screening.recommend}
                  </p>
                  <div className="md:col-span-2">
                    <p className="text-gray-400 text-sm mb-1">Rationale</p>
                    <pre className="bg-gray-900/50 rounded-lg p-3 text-xs whitespace-pre-wrap">
                      {JSON.stringify(details.screening.ai_rationale, null, 2)}
                    </pre>
                  </div>
                  {details.screening.red_flags && (
                    <div className="md:col-span-2">
                      <p className="text-gray-400 text-sm mb-1">Red Flags</p>
                      <pre className="bg-gray-900/50 rounded-lg p-3 text-xs whitespace-pre-wrap text-red-300">
                        {JSON.stringify(details.screening.red_flags, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-gray-400 text-sm">
                  No AI screening data found.
                </p>
              )}
            </section>

            <section className="bg-gray-800/60 border border-purple-500/30 rounded-xl p-5">
              <h2 className="text-xl font-semibold mb-3">Interviews</h2>
              {details.interviews && details.interviews.length > 0 ? (
                <div className="space-y-3">
                  {details.interviews.map((iv) => (
                    <div
                      key={iv.id}
                      className="border border-gray-700 rounded-lg p-3 text-sm text-gray-300"
                    >
                      <p className="font-semibold text-white">
                        {iv.stage} • {iv.status}
                      </p>
                      <p>
                        {iv.date} at {iv.time} • {iv.mode}
                      </p>
                      {iv.notes && (
                        <p className="text-gray-400 text-xs mt-1">{iv.notes}</p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-400 text-sm">
                  No interviews scheduled yet.
                </p>
              )}
            </section>
          </div>
        ) : null}
      </div>
    </div>
  );
}

