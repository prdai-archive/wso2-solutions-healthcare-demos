package care_loop.care_loop_ai_service;

import io.ballerina.runtime.api.Environment;
import io.ballerina.runtime.api.creators.ErrorCreator;
import io.ballerina.runtime.api.utils.StringUtils;
import io.ballerina.runtime.api.values.BObject;
import io.ballerina.runtime.api.values.BTypedesc;

// Stub for GeminiModelProvider.generate(), which nothing on this service's
// path calls (ai:Agent's FunctionCallAgent only calls chat()). The
// ai:ModelProvider interface's generate() is dependently-typed, which
// Ballerina only allows on external functions - this satisfies that
// requirement without pretending an unused method is implemented.
public final class GeminiGenerateStub {
    private GeminiGenerateStub() {
    }

    public static Object generate(Environment env, BObject self, BObject prompt, BTypedesc td) {
        return ErrorCreator.createError(
                StringUtils.fromString("GeminiModelProvider.generate() is not implemented - unused by ai:Agent"));
    }
}
